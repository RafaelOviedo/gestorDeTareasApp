package com.gestordetareasapp.calendar

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class TaskCalendarPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == TaskCalendarModule.NAME) TaskCalendarModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(TaskCalendarModule.NAME to ReactModuleInfo(
      TaskCalendarModule.NAME, TaskCalendarModule.NAME, false, false, false, true
    ))
  }
}
