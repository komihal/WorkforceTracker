# Полное тестирование сценариев A/C/D с активным трекингом

## 🎯 **Готово к тестированию!**

**BG_TEST_FORCE_TRACKING=1** включен - теперь можно тестировать все сценарии с активным BG Geo трекингом.

---

## 📱 **Шаги для тестирования**

### **1. Включить тестовый трекинг**
1. Откройте приложение WorkforceTracker
2. Нажмите зеленую кнопку **"🔬 BG Test Suite"**
3. В секции **"Test Tracking Override"** нажмите **"Start Test Tracking"**
4. Должно появиться сообщение: **"Test tracking started! BG Geo will now track even without active shift."**
5. Статус должен измениться на **"🟢 Active"**

### **2. Scenario A: Revoke Background → Move**

**Цель**: Проверить, что при разрешении "While Using" фоновые HTTP события не отправляются.

**Шаги**:
1. **Включите тестовый трекинг** (см. выше)
2. **Сделайте снимок логов**:
   ```bash
   adb logcat -c && adb logcat -d -v time -s TSLocationManager ReactNativeJS > bggeo_A_revoke.log
   ```
3. **Измените разрешение**:
   - Откройте Settings → Apps → WorkforceTracker → Permissions → Location
   - Измените с **"Allow all the time"** на **"Allow only while in use"**
4. **Вернитесь в приложение** и походите 2-3 минуты
5. **Заблокируйте экран** и продолжайте ходить 2-3 минуты
6. **Разблокируйте** и проверьте результаты

**Ожидаемый результат**: 
- ✅ **PASS**: Нет HTTP событий во время блокировки экрана
- ❌ **FAIL**: HTTP события продолжаются при блокировке

### **3. Scenario C: Doze → Move**

**Цель**: Проверить накопление точек в doze режиме и batch upload после отключения.

**Шаги**:
1. **Включите тестовый трекинг**
2. **Сделайте снимок логов**:
   ```bash
   adb logcat -c && adb logcat -d -v time -s TSLocationManager ReactNativeJS > bggeo_C_doze.log
   ```
3. **Включите doze режим**:
   ```bash
   adb shell dumpsys deviceidle enable
   adb shell dumpsys deviceidle force-idle
   ```
4. **Походите 2-3 минуты** (точки должны накапливаться)
5. **Отключите doze**:
   ```bash
   adb shell dumpsys deviceidle disable
   ```
6. **Подождите 30 секунд** и проверьте batch upload

**Ожидаемый результат**:
- ✅ **PASS**: После отключения doze приходит batch upload (onSync, несколько onHttp 2xx)
- ❌ **FAIL**: Нет batch upload после отключения doze

### **4. Scenario D: Airplane → Online**

**Цель**: Проверить накопление точек в оффлайн режиме и batch upload после восстановления сети.

**Шаги**:
1. **Включите тестовый трекинг**
2. **Сделайте снимок логов**:
   ```bash
   adb logcat -c && adb logcat -d -v time -s TSLocationManager ReactNativeJS > bggeo_D_airplane.log
   ```
3. **Включите airplane режим**:
   ```bash
   adb shell settings put global airplane_mode_on 1
   ```
4. **Походите 5-10 минут** (точки должны накапливаться оффлайн)
5. **Отключите airplane режим**:
   ```bash
   adb shell settings put global airplane_mode_on 0
   ```
6. **Подождите 60 секунд** и проверьте batch upload

**Ожидаемый результат**:
- ✅ **PASS**: После восстановления сети приходит batch upload (onSync, несколько onHttp 2xx)
- ❌ **FAIL**: Нет batch upload после восстановления сети

---

## 🔍 **Анализ логов**

### **Что искать в логах**:

1. **HTTP события**:
   ```
   [BG][http] true 200 ...
   ```

2. **Batch upload**:
   ```
   [BG][sync] batch uploaded: 15 locations
   ```

3. **Location события**:
   ```
   [BG][location] 55.7558 37.6176 acc=5.0
   ```

4. **Ошибки**:
   ```
   [BG][Error] ...
   ```

### **Команды для анализа**:

```bash
# Проверить HTTP события
grep "\[BG\]\[http\]" bggeo_A_revoke.log

# Проверить batch upload
grep "\[BG\]\[sync\]" bggeo_C_doze.log

# Проверить location события
grep "\[BG\]\[location\]" bggeo_D_airplane.log

# Подсчитать количество событий
grep -c "\[BG\]\[http\]" bggeo_*.log
```

---

## 📊 **Ожидаемые результаты**

| Сценарий | Активный трекинг | Фоновый трекинг | Batch upload |
|----------|------------------|-----------------|--------------|
| **A: Revoke Background** | ✅ HTTP события | ❌ Нет HTTP | N/A |
| **C: Doze Mode** | ✅ Накопление | ✅ Накопление | ✅ Batch после disable |
| **D: Airplane Mode** | ✅ Накопление | ✅ Накопление | ✅ Batch после online |

---

## 🚀 **Готово к запуску!**

Все компоненты готовы:
- ✅ **Тестовый флаг включен** (BG_TEST_FORCE_TRACKING=1)
- ✅ **UI обновлен** с кнопкой тестового трекинга
- ✅ **Безопасные команды** для сбора логов
- ✅ **Подробные инструкции** для каждого сценария

**Начинайте тестирование!** 🎯
