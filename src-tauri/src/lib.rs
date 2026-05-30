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

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComicDirectoryNode {
  pub name: String,
  pub path: String,
  pub children: Vec<ComicDirectoryNode>,
  pub image_count: usize,
  pub readable: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComicChapter {
  pub name: String,
  pub path: String,
  pub relative_path: String,
  pub image_count: usize,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComicLibraryScanResult {
  pub root: FolderInfo,
  pub tree: ComicDirectoryNode,
  pub chapters: Vec<ComicChapter>,
}

fn is_supported_image(path: &Path) -> bool {
  let image_extensions = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
  path.extension()
    .and_then(|extension| extension.to_str())
    .map(|extension| image_extensions.contains(&extension.to_lowercase().as_str()))
    .unwrap_or(false)
}

fn path_name(path: &Path) -> String {
  path.file_name()
    .and_then(|name| name.to_str())
    .unwrap_or("Unknown")
    .to_string()
}

fn scan_directory_node(
  path: &Path,
  root_path: &Path,
  chapters: &mut Vec<ComicChapter>,
) -> Result<ComicDirectoryNode, String> {
  let entries = fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))?;
  let mut child_dirs = Vec::new();
  let mut image_count = 0usize;

  for entry in entries {
    let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
    let entry_path = entry.path();

    if entry_path.is_dir() {
      child_dirs.push(entry_path);
    } else if entry_path.is_file() && is_supported_image(&entry_path) {
      image_count += 1;
    }
  }

  child_dirs.sort_by(|a, b| {
    let name_a = a.file_name().and_then(|name| name.to_str()).unwrap_or("");
    let name_b = b.file_name().and_then(|name| name.to_str()).unwrap_or("");
    natord::compare(name_a, name_b)
  });

  let mut children = Vec::new();
  for child_dir in child_dirs {
    children.push(scan_directory_node(&child_dir, root_path, chapters)?);
  }

  let name = path_name(path);
  let full_path = path.to_string_lossy().to_string();
  let readable = image_count > 0;

  if readable {
    let relative_path = path
      .strip_prefix(root_path)
      .ok()
      .map(|relative| {
        let value = relative.to_string_lossy().replace('\\', "/");
        if value.is_empty() { name.clone() } else { value }
      })
      .unwrap_or_else(|| name.clone());

    chapters.push(ComicChapter {
      name: name.clone(),
      path: full_path.clone(),
      relative_path,
      image_count,
    });
  }

  Ok(ComicDirectoryNode {
    name,
    path: full_path,
    children,
    image_count,
    readable,
  })
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

  // 排序由前端 naturalSort 统一处理，Rust 端不再重复排序
  Ok(image_files)
}

#[command]
async fn read_image_file(file_path: String) -> Result<Vec<u8>, String> {
  fs::read(&file_path).map_err(|e| format!("读取文件失败: {}", e))
}

/// 获取当前文件夹同级的下一个文件夹（按名称排序后的下一个）
#[command]
async fn scan_comic_library(root_path: String) -> Result<ComicLibraryScanResult, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let path = Path::new(&root_path);
    if !path.exists() || !path.is_dir() {
      return Err("Folder does not exist or is not a directory".to_string());
    }

    let mut chapters = Vec::new();
    let tree = scan_directory_node(path, path, &mut chapters)?;
    chapters.sort_by(|a, b| natord::compare(&a.relative_path, &b.relative_path));

    Ok(ComicLibraryScanResult {
      root: FolderInfo {
        name: path_name(path),
        path: path.to_string_lossy().to_string(),
      },
      tree,
      chapters,
    })
  })
  .await
  .map_err(|error| format!("Failed to join scan task: {}", error))?
}

#[command]
async fn get_next_sibling_folder(folder_path: String) -> Result<Option<FolderInfo>, String> {
  let path = Path::new(&folder_path);
  if !path.exists() || !path.is_dir() {
    return Err("文件夹不存在或不是目录".to_string());
  }

  let parent = match path.parent() {
    Some(p) => p,
    None => return Ok(None),
  };

  if !parent.exists() || !parent.is_dir() {
    return Ok(None);
  }

  let current_name = path
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("")
    .to_string();

  let mut sibling_dirs: Vec<(String, String)> = Vec::new();
  let entries = fs::read_dir(parent).map_err(|e| format!("读取父目录失败: {}", e))?;

  for entry in entries {
    let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
    let entry_path = entry.path();

    if entry_path.is_dir() {
      if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
        let full_path = entry_path.to_string_lossy().to_string();
        sibling_dirs.push((name.to_string(), full_path));
      }
    }
  }

  // 使用自然排序，使 1、2、10 按数字顺序排列，而非字典序
  sibling_dirs.sort_by(|a, b| natord::compare(&a.0, &b.0));

  let mut found_current = false;
  for (name, full_path) in sibling_dirs {
    if found_current {
      return Ok(Some(FolderInfo {
        name,
        path: full_path,
      }));
    }
    if name == current_name {
      found_current = true;
    }
  }

  Ok(None)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      select_folder,
      read_image_files,
      read_image_file,
      get_next_sibling_folder,
      scan_comic_library
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
