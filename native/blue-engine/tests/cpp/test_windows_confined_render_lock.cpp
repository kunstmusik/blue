#include <windows.h>

#include <cstdio>
#include <string>

int main() {
  wchar_t temp[MAX_PATH];
  wchar_t root[MAX_PATH];
  const DWORD tempLength = GetTempPathW(MAX_PATH, temp);
  if (tempLength == 0 || tempLength >= MAX_PATH ||
      GetTempFileNameW(temp, L"bmc", 0, root) == 0 ||
      !DeleteFileW(root) || !CreateDirectoryW(root, nullptr)) {
    std::fprintf(stderr, "Could not create a temporary render destination\n");
    return 1;
  }

  // Match the production directory handle's sharing mode at publication.
  const HANDLE locked = CreateFileW(
      root, FILE_LIST_DIRECTORY | FILE_ADD_FILE, FILE_SHARE_READ | FILE_SHARE_WRITE,
      nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
      nullptr);
  const std::wstring moved = std::wstring(root) + L".moved";
  if (locked == INVALID_HANDLE_VALUE) {
    RemoveDirectoryW(root);
    return 1;
  }

  const BOOL movedWhileLocked = MoveFileExW(root, moved.c_str(), 0);
  const DWORD renameError = GetLastError();
  CloseHandle(locked);
  if (movedWhileLocked) {
    RemoveDirectoryW(moved.c_str());
    std::fprintf(stderr, "A destination without delete sharing allowed a rename\n");
    return 1;
  }
  const BOOL movedAfterClose = MoveFileExW(root, moved.c_str(), 0);
  RemoveDirectoryW(movedAfterClose ? moved.c_str() : root);
  if (!movedAfterClose ||
      (renameError != ERROR_SHARING_VIOLATION && renameError != ERROR_ACCESS_DENIED)) {
    std::fprintf(stderr, "Rename did not follow the expected handle lifetime (%lu)\n",
                 static_cast<unsigned long>(renameError));
    return 1;
  }
  return 0;
}
