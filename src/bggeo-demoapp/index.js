/**
 * @format
 */


import {AppRegistry} from 'react-native';



import App from './App';
import {name as appName} from './app.json';

import BackgroundGeolocation from "./src/react-native-background-geolocation";
import BackgroundFetch from "react-native-background-fetch";

import ENV from './src/ENV';

AppRegistry.registerComponent(appName, () => App);

// [Android-only] See API docs Config.enableHeadless.  This method MUST exist here in index.js.
// An Android Headless Task will receive all events emitted by the background-geolocation plugin while
// your app is terminated.
//
const bgGeoHeadlessTask = async (event) => {
  const params     = event.params; // <-- our event-data from the BG Geo SDK.
  const eventName  = event.name;
  const taskId     = event.taskId; // <-- very important!
  
  console.log(`[BGGeoHeadlessTask] ${eventName}`, JSON.stringify(params));
  // You MUST await your work!
  // HeadlessTasks are automatically terminated after execution of the last line of your function.
  await doWork(eventName);    
}

BackgroundGeolocation.registerHeadlessTask(bgGeoHeadlessTask);

///
/// A stupid little "long running task" simulator for headless-tasks.
/// Uses a simple JS setTimeout timer to simulate work.
/// 
let doWorkCounter = 0;

const doWork = async (eventName) => {
  return new Promise(async (resolve, reject) => {    
    if (eventName == 'terminate') {
      doWorkCounter = 0;
      // Perform a weird action (for testing) with an interval timer and .startBackgroundTask.
      const bgTaskId = await BackgroundGeolocation.startBackgroundTask();
      // Print * tick * to log every second.
      const timer = setInterval(() => {
        console.log(`[BGGeoHeadlessTask][doWork] * tick ${++doWorkCounter}/10 *`);
      }, 1000);
      // After 10s, stop the interval and stop our background-task.
      setTimeout(() => {
        clearInterval(timer);
        BackgroundGeolocation.stopBackgroundTask(bgTaskId);
        resolve();
      }, 10000);

    } else {
      // do nothing
      console.log('[BGGeoHeadlessTask][doWork]', eventName);
      resolve();
    }
  });
}

/**
* BackgroundFetch Headless JS Task.
* For more information, see:  https://github.com/transistorsoft/react-native-background-fetch#config-boolean-enableheadless-false
*/
const BackgroundFetchHeadlessTask = async (event) => {
  console.log('[BackgroundFetch HeadlessTask] start', event.taskId);
  
  if (event.taskId == 'react-native-background-fetch') {
    const location = await BackgroundGeolocation.getCurrentPosition({
      samples: 1,
      extras: {
        event: 'background-fetch',
        headless: true
      }
    });
    console.log('[BackgroundFetch] getCurrentPosition: ', location);    
  }
    
  console.log('[BackgroundFetch HeadlessTask] finished');

  BackgroundFetch.finish(event.taskId);
}


// Register your BackgroundFetch HeadlessTask
BackgroundFetch.registerHeadlessTask(BackgroundFetchHeadlessTask);
