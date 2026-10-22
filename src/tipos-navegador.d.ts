// APIs do navegador ainda não incluídas nos tipos do TypeScript.

interface FileSystemPermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemHandle {
  queryPermission?(d?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  requestPermission?(d?: FileSystemPermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemHandle>;
}

interface Window {
  showDirectoryPicker?(opcoes?: { id?: string; mode?: "read" | "readwrite"; startIn?: string }): Promise<FileSystemDirectoryHandle>;
}

interface Navigator {
  standalone?: boolean;
}
