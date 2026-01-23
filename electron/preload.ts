import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { IPCHandlers } from '../shared/ipc';

const api = {
  invoke: <K extends keyof IPCHandlers>(
    channel: K,
    payload?: IPCHandlers[K]['request']
  ): Promise<IPCHandlers[K]['response']> => {
    return ipcRenderer.invoke(channel, payload);
  },
  
  on: <T = unknown>(
    channel: string, 
    callback: (data: T) => void
  ): (() => void) => {
    const handler = (_event: IpcRendererEvent, data: T) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  
  once: <T = unknown>(
    channel: string,
    callback: (data: T) => void
  ): void => {
    ipcRenderer.once(channel, (_event: IpcRendererEvent, data: T) => callback(data));
  }
};

contextBridge.exposeInMainWorld('api', api);

export type API = typeof api;
