import { ContextBridge } from "@common/ContextBridge";
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ContextBridge", <ContextBridge>{
    getRescanState: () => ipcRenderer.sendSync("getRescanState"),
    getSearchResultItems: () => ipcRenderer.sendSync("getSearchResultItems"),
    onNativeThemeChanged: (callback) => ipcRenderer.on("nativeThemeChanged", callback),
    onSearchIndexUpdated: (callback) => ipcRenderer.on("searchIndexUpdated", callback),
    onRescanStateChanged: (callback) => ipcRenderer.on("rescanStateChanged", (_, rescanState) => callback(rescanState)),
    themeShouldUseDarkColors: () => ipcRenderer.sendSync("themeShouldUseDarkColors"),
});