package com.gestordetareasapp.calendar

import android.Manifest
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import java.util.TimeZone
import java.util.concurrent.Executors
import org.json.JSONObject

@ReactModule(name = TaskCalendarModule.NAME)
class TaskCalendarModule(private val context: ReactApplicationContext) : NativeTaskCalendarSpec(context) {
  companion object {
    const val NAME = "NativeTaskCalendar"
    // Compartida entre instancias de React (incluyendo recargas de Metro).
    private val executor = Executors.newSingleThreadExecutor()
  }

  override fun getName() = NAME

  private fun hasAccess() = listOf(
    Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR
  ).all { context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }

  private fun calendars(): List<Pair<String, String>> {
    val result = mutableListOf<Pair<String, String>>()
    context.contentResolver.query(
      CalendarContract.Calendars.CONTENT_URI,
      arrayOf(CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME),
      "${CalendarContract.Calendars.VISIBLE} = 1 AND ${CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL} >= ?",
      arrayOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR.toString()),
      "${CalendarContract.Calendars.CALENDAR_DISPLAY_NAME} ASC"
    )?.use { cursor ->
      while (cursor.moveToNext()) {
        result.add(cursor.getLong(0).toString() to (cursor.getString(1) ?: "Calendario"))
      }
    }
    return result
  }

  override fun getCalendars(promise: Promise) {
    executor.execute {
      if (!hasAccess()) {
        promise.reject("permission", "Autorizá el acceso al calendario desde Ajustes.")
        return@execute
      }
      try {
        val result = Arguments.createArray()
        calendars().forEach { (id, title) ->
          result.pushMap(Arguments.createMap().apply {
            putString("id", id)
            putString("title", title)
          })
        }
        promise.resolve(result)
      } catch (error: Exception) {
        promise.reject("calendar_failed", "No se pudieron consultar los calendarios.", error)
      }
    }
  }

  private fun asMap(event: JSONObject): WritableMap = Arguments.createMap().apply {
    putString("eventId", event.getString("eventId"))
    putString("calendarId", event.getString("calendarId"))
    putString("calendarName", event.getString("calendarName"))
    putDouble("startDate", event.getDouble("startDate"))
    putDouble("endDate", event.getDouble("endDate"))
  }

  override fun createEvent(
    operationId: String, calendarId: String, title: String, startDate: Double,
    endDate: Double, notes: String, location: String, promise: Promise
  ) {
    executor.execute {
      if (!hasAccess()) {
        promise.reject("permission", "Autorizá el acceso al calendario desde Ajustes.")
        return@execute
      }
      try {
        val journal = context.getSharedPreferences("taskCalendar", Context.MODE_PRIVATE)
        val previous = journal.getString(operationId, null)
        if (previous != null) {
          val saved = JSONObject(previous)
          if (saved.has("eventId")) {
            promise.resolve(asMap(saved))
          } else {
            promise.reject("uncertain", "La creación anterior se interrumpió. Revisá la app Calendario; no se creará otro evento para evitar duplicados.")
          }
          return@execute
        }
        if (operationId.isBlank() || title.isBlank() || !startDate.isFinite() ||
          !endDate.isFinite() || endDate <= startDate || startDate <= System.currentTimeMillis()) {
          promise.reject("invalid", "Revisá la fecha y la duración del evento.")
          return@execute
        }
        val calendar = calendars().find { it.first == calendarId }
        if (calendar == null) {
          promise.reject("no_calendar", "El calendario ya no está disponible. Elegí otro calendario que permita agregar eventos.")
          return@execute
        }
        // Registrar antes de insertar evita un segundo evento si el proceso se interrumpe.
        if (!journal.edit().putString(operationId, "{\"pending\":true}").commit()) {
          promise.reject("save_failed", "No se pudo preparar el evento. Liberá espacio e intentá nuevamente.")
          return@execute
        }
        val values = ContentValues().apply {
          put(CalendarContract.Events.CALENDAR_ID, calendarId.toLong())
          put(CalendarContract.Events.TITLE, title)
          put(CalendarContract.Events.DTSTART, startDate.toLong())
          put(CalendarContract.Events.DTEND, endDate.toLong())
          put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().id)
          put(CalendarContract.Events.DESCRIPTION, notes)
          put(CalendarContract.Events.EVENT_LOCATION, location)
        }
        val uri = context.contentResolver.insert(CalendarContract.Events.CONTENT_URI, values)
        if (uri == null) {
          journal.edit().remove(operationId).commit()
          promise.reject("save_failed", "No se pudo crear el evento. Intentá nuevamente.")
          return@execute
        }
        val result = JSONObject().apply {
          put("eventId", ContentUris.parseId(uri).toString())
          put("calendarId", calendarId)
          put("calendarName", calendar.second)
          put("startDate", startDate)
          put("endDate", endDate)
        }
        if (!journal.edit().putString(operationId, result.toString()).commit()) {
          promise.reject("uncertain", "El evento se creó, pero no se pudo registrar su vínculo. Revisá la app Calendario.")
          return@execute
        }
        promise.resolve(asMap(result))
      } catch (error: Exception) {
        // Un resultado incierto conserva la marca pendiente para no insertar dos veces.
        promise.reject("calendar_failed", "No se pudo confirmar la creación del evento. Revisá la app Calendario antes de reintentar.", error)
      }
    }
  }
}
