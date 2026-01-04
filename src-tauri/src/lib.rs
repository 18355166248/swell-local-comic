use std::fs;
use std::path::Path;
use tauri::command;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ImageFileInfo {
  pub name: String,
  pub path: String,
}

#[derive(Serialize, Deserialize)]
pub struct FolderInfo {
  pub name: String,
  pub path: String,
}

#[command]
async fn select_folder() -> Result<Option<FolderInfo>, String> {
  match rfd::AsyncFileDialog::new().pick_folder().await {
    Some(folder) => {
      let path_str = folder.path().to_string_lossy().to_string();
      let name = Path::new(&path_str)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

      Ok(Some(FolderInfo {
        name,
        path: path_str,
      }))
    }
    None => Ok(None),
  }
}

#[command]
async fn read_image_files(folder_path: String) -> Result<Vec<ImageFileInfo>, String> {
  let path = Path::new(&folder_path);
  if !path.exists() || !path.is_dir() {
    return Err("文件夹不存在或不是目录".to_string());
  }

  let mut image_files = Vec::new();

  // 支持的图片格式
  let image_extensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];

  let entries = fs::read_dir(path).map_err(|e| format!("读取目录失败: {}", e))?;

  for entry in entries {
    let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
    let path = entry.path();

    if path.is_file() {
      if let Some(extension) = path.extension() {
        let ext_str = extension.to_str().unwrap_or("").to_lowercase();
        if image_extensions.contains(&ext_str.as_str()) {
          let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

          let full_path = path.to_string_lossy().to_string();

          image_files.push(ImageFileInfo {
            name,
            path: full_path,
          });
        }
      }
    }
  }

  // 按文件名排序
  image_files.sort_by(|a, b| a.name.cmp(&b.name));

  Ok(image_files)
}

#[command]
async fn read_image_file(file_path: String) -> Result<Vec<u8>, String> {
  fs::read(&file_path).map_err(|e| format!("读取文件失败: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      select_folder,
      read_image_files,
      read_image_file
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
