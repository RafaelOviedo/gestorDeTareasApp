#import "RCTTaskCalendar.h"
#import <EventKit/EventKit.h>
#include <cmath>

@implementation RCTTaskCalendar

+ (NSString *)moduleName { return @"NativeTaskCalendar"; }

- (BOOL)hasAccess
{
  EKAuthorizationStatus status = [EKEventStore authorizationStatusForEntityType:EKEntityTypeEvent];
  if (@available(iOS 17.0, *)) {
    return status == EKAuthorizationStatusFullAccess;
  }
  return status == EKAuthorizationStatusAuthorized;
}

- (void)getCalendars:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (![self hasAccess]) {
      reject(@"permission", @"Autorizá el acceso al calendario desde Ajustes.", nil);
      return;
    }
    EKEventStore *store = [[EKEventStore alloc] init];
    // La creación sigue usando el calendario predeterminado del dispositivo.
    resolve(store.defaultCalendarForNewEvents
      ? @[@{@"id": @"default", @"title": @"Calendario predeterminado"}]
      : @[]);
  });
}

- (void)getEvent:(NSString *)eventId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (![self hasAccess]) {
      reject(@"permission", @"Autorizá el acceso completo al calendario para verificar el evento.", nil);
      return;
    }
    if (!eventId.length) {
      reject(@"invalid", @"El identificador del evento no es válido.", nil);
      return;
    }
    EKEventStore *store = [[EKEventStore alloc] init];
    EKEvent *event = [store eventWithIdentifier:eventId];
    if (!event) {
      // No interpretar una revocación de permisos como un evento eliminado.
      if (![self hasAccess]) {
        reject(@"permission", @"El permiso de calendario cambió. Revisalo desde Ajustes.", nil);
      } else {
        resolve((id)kCFNull);
      }
      return;
    }
    resolve(@{
      @"eventId": event.eventIdentifier,
      @"calendarId": event.calendar.calendarIdentifier,
      @"calendarName": event.calendar.title ?: @"Calendario",
      @"startDate": @(event.startDate.timeIntervalSince1970 * 1000),
      @"endDate": @(event.endDate.timeIntervalSince1970 * 1000)
    });
  });
}

- (void)deleteEvent:(NSString *)eventId resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (![self hasAccess]) {
      reject(@"permission", @"Autorizá el acceso completo al calendario para eliminar el evento.", nil);
      return;
    }
    if (!eventId.length) {
      reject(@"invalid", @"El identificador del evento no es válido.", nil);
      return;
    }
    EKEventStore *store = [[EKEventStore alloc] init];
    EKEvent *event = [store eventWithIdentifier:eventId];
    NSError *error = nil;
    if (![self hasAccess]) {
      reject(@"permission", @"El permiso de calendario cambió. Revisalo desde Ajustes.", nil);
    } else if (event && ![store removeEvent:event span:EKSpanThisEvent commit:YES error:&error]) {
      reject(@"delete_failed", @"No se pudo eliminar el evento del calendario. Intentá nuevamente.", error);
    } else {
      // Repetir la eliminación es seguro si falló el guardado local después.
      resolve(@YES);
    }
  });
}

- (void)createEvent:(NSString *)operationId
        calendarId:(NSString *)calendarId
             title:(NSString *)title
         startDate:(double)startDate
           endDate:(double)endDate
             notes:(NSString *)notes
          location:(NSString *)location
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  // Serializa la inserción y conserva el resultado para recuperar un vínculo
  // si AsyncStorage falla después de guardar el evento.
  dispatch_async(dispatch_get_main_queue(), ^{
    if (![self hasAccess]) {
      reject(@"permission", @"Autorizá el acceso al calendario desde Ajustes.", nil);
      return;
    }
    NSString *key = [@"taskCalendar:" stringByAppendingString:operationId];
    NSUserDefaults *defaults = NSUserDefaults.standardUserDefaults;
    NSDictionary *previous = [defaults dictionaryForKey:key];
    if (previous) {
      if (previous[@"eventId"]) {
        resolve(previous);
      } else {
        reject(@"uncertain", @"La creación anterior se interrumpió. Revisá la app Calendario; no se creará otro evento para evitar duplicados.", nil);
      }
      return;
    }
    if (!operationId.length || !title.length || ![calendarId isEqualToString:@"default"] ||
        !std::isfinite(startDate) || !std::isfinite(endDate) || endDate <= startDate ||
        startDate <= NSDate.date.timeIntervalSince1970 * 1000) {
      reject(@"invalid", @"Revisá la fecha y la duración del evento.", nil);
      return;
    }
    EKEventStore *store = [[EKEventStore alloc] init];
    EKCalendar *calendar = store.defaultCalendarForNewEvents;
    if (!calendar) {
      reject(@"no_calendar", @"Configurá un calendario que permita agregar eventos en la app Calendario.", nil);
      return;
    }
    EKEvent *event = [EKEvent eventWithEventStore:store];
    event.calendar = calendar;
    event.title = title;
    event.startDate = [NSDate dateWithTimeIntervalSince1970:startDate / 1000];
    event.endDate = [NSDate dateWithTimeIntervalSince1970:endDate / 1000];
    event.notes = notes;
    event.location = location;
    [defaults setObject:@{@"pending": @YES} forKey:key];
    NSError *error = nil;
    if (![store saveEvent:event span:EKSpanThisEvent commit:YES error:&error]) {
      [defaults removeObjectForKey:key];
      reject(@"save_failed", @"No se pudo crear el evento. Revisá tu calendario e intentá nuevamente.", error);
      return;
    }
    if (!event.eventIdentifier.length) {
      reject(@"uncertain", @"El calendario guardó el evento sin devolver su identificador. Revisá la app Calendario antes de continuar.", nil);
      return;
    }
    NSDictionary *result = @{
      @"eventId": event.eventIdentifier,
      @"calendarId": @"default",
      @"calendarName": @"Calendario predeterminado",
      @"startDate": @(startDate),
      @"endDate": @(endDate)
    };
    [defaults setObject:result forKey:key];
    resolve(result);
  });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeTaskCalendarSpecJSI>(params);
}
@end
