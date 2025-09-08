// Канонический headless task для Transistorsoft
import BackgroundGeolocation from "react-native-background-geolocation";

const HeadlessTask = async (event) => {
  console.log('[BG HEADLESS] Event received:', event.name);
  
  switch (event.name) {
    case "http":
      console.log("[BG HEADLESS HTTP] Success:", {
        status: event.params.status,
        responseText: event.params.responseText?.substring(0, 100)
      });
      break;
      
    case "http_failure":
      console.log("[BG HEADLESS HTTP] Failure:", {
        status: event.params.status,
        responseText: event.params.responseText?.substring(0, 100)
      });
      break;
      
    case "heartbeat":
      console.log("[BG HEADLESS] Heartbeat received");
      // Опционально: получить текущую позицию в headless
      try {
        await BackgroundGeolocation.getCurrentPosition({
          persist: true,
          samples: 1,
          desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH
        });
        console.log("[BG HEADLESS] Current position requested");
      } catch (e) {
        console.log("[BG HEADLESS] getCurrentPosition error:", e.message);
      }
      break;
      
    case "connectivitychange":
      console.log("[BG HEADLESS] Connectivity changed:", event.params.connected);
      break;
      
    case "motionchange":
      console.log("[BG HEADLESS] Motion changed:", event.params.isMoving);
      break;
      
    default:
      console.log("[BG HEADLESS] Unknown event:", event.name);
  }
};

BackgroundGeolocation.registerHeadlessTask(HeadlessTask);
export default HeadlessTask;