#!/bin/bash
# BG Geo Safe Commands - предотвращает зависания

# 1) Снимок буфера (предпочтительно)
alias bgg_snapshot='adb logcat -c && adb logcat -d -v time -s TSLocationManager ReactNativeJS > bggeo_$(date +%Y%m%d_%H%M%S).log'

# 2) Стрим с лимитом времени (20 секунд)
bgg_stream_20s(){ timeout 20s adb logcat -v time -s TSLocationManager ReactNativeJS; }

# 3) Стрим с лимитом сообщений (200 сообщений)
bgg_stream_200(){ adb logcat -v time -s TSLocationManager ReactNativeJS -m 200; }

# 4) Экстренно остановить всё
alias bgg_kill='pkill -f "adb logcat" || true; pkill -f "tail -f" || true; adb kill-server'

# 5) Безопасный просмотр логов
alias bgg_tail='tail -n 50'
alias bgg_head='head -n 20'

echo "BG Geo Safe Commands loaded!"
echo "Available commands:"
echo "  bgg_snapshot    - take a snapshot of logs"
echo "  bgg_stream_20s  - stream logs for 20 seconds"
echo "  bgg_stream_200  - stream 200 log messages"
echo "  bgg_kill        - kill all hanging processes"
echo "  bgg_tail file   - safely view last 50 lines"
echo "  bgg_head file   - safely view first 20 lines"
