"""
摄像头模块

提供摄像头拍照功能，支持OpenCV和imagesnap两种方式。
"""
import os
import logging
import datetime
import pathlib
import shutil
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)


class Camera:
    """摄像头拍照类"""
    
    def __init__(self, device_index: int = 0, output_dir: str = "data/photos"):
        """初始化摄像头
        
        Args:
            device_index: 摄像头设备索引（默认0）
            output_dir: 照片输出目录
        """
        self.device_index = device_index
        self.output_dir = output_dir
        
        try:
            pathlib.Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        except OSError as e:
            logger.error(f"创建输出目录失败: {e}")
            raise
        
        # 检测可用的拍照方法
        self._check_available_methods()
    
    def _check_available_methods(self) -> None:
        """检测可用的拍照方法"""
        self.has_opencv = False
        self.has_imagesnap = False
        
        # 检查OpenCV
        try:
            import cv2
            cap = cv2.VideoCapture(self.device_index)
            if cap.isOpened():
                self.has_opencv = True
                cap.release()
                logger.info("检测到OpenCV支持")
        except ImportError:
            logger.debug("OpenCV未安装")
        except Exception as e:
            logger.debug(f"OpenCV检测失败: {e}")
        
        # 检查imagesnap
        if shutil.which("imagesnap"):
            self.has_imagesnap = True
            logger.info("检测到imagesnap支持")
        
        if not self.has_opencv and not self.has_imagesnap:
            logger.warning("未找到可用的拍照方法，拍照功能可能无法使用")
    
    def capture(self, tag: Optional[str] = None) -> Optional[str]:
        """拍照
        
        Args:
            tag: 照片标签（会添加到文件名中）
            
        Returns:
            照片文件路径，失败返回None
        """
        try:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            name = f"{timestamp}{'_' + tag if tag else ''}.jpg"
            path = os.path.join(self.output_dir, name)
            
            # 优先使用OpenCV
            if self.has_opencv:
                result = self._capture_with_opencv(path)
                if result:
                    return result
            
            # 回退到imagesnap
            if self.has_imagesnap:
                result = self._capture_with_imagesnap(path)
                if result:
                    return result
            
            logger.error("所有拍照方法都失败")
            return None
            
        except Exception as e:
            logger.error(f"拍照失败: {e}", exc_info=True)
            return None
    
    def _capture_with_opencv(self, path: str) -> Optional[str]:
        """使用OpenCV拍照
        
        Args:
            path: 保存路径
            
        Returns:
            成功返回路径，失败返回None
        """
        try:
            import cv2
            
            cap = cv2.VideoCapture(self.device_index)
            if not cap.isOpened():
                logger.warning(f"无法打开摄像头设备 {self.device_index}")
                cap.release()
                return None
            
            # 设置分辨率（可选）
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            
            # 读取一帧（给摄像头一些时间调整）
            for _ in range(3):
                ret, frame = cap.read()
                if ret:
                    break
            
            if not ret or frame is None:
                logger.warning("无法从摄像头读取画面")
                cap.release()
                return None
            
            # 保存照片
            success = cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
            cap.release()
            
            if success and os.path.exists(path):
                file_size = os.path.getsize(path)
                logger.debug(f"照片已保存: {path} ({file_size} bytes)")
                return path
            else:
                logger.warning("照片保存失败")
                return None
                
        except ImportError:
            logger.debug("OpenCV未安装")
            return None
        except Exception as e:
            logger.warning(f"OpenCV拍照失败: {e}")
            return None
    
    def _capture_with_imagesnap(self, path: str) -> Optional[str]:
        """使用imagesnap拍照（macOS）
        
        Args:
            path: 保存路径
            
        Returns:
            成功返回路径，失败返回None
        """
        bin_path = shutil.which("imagesnap")
        if not bin_path:
            return None
        
        try:
            # imagesnap参数: -w 1 表示等待1秒后拍照
            result = subprocess.run(
                [bin_path, "-w", "1", path],
                check=True,
                capture_output=True,
                timeout=5
            )
            
            if os.path.exists(path):
                file_size = os.path.getsize(path)
                logger.debug(f"照片已保存: {path} ({file_size} bytes)")
                return path
            else:
                logger.warning("imagesnap执行成功但文件不存在")
                return None
                
        except subprocess.TimeoutExpired:
            logger.warning("imagesnap执行超时")
            return None
        except subprocess.CalledProcessError as e:
            logger.warning(f"imagesnap执行失败: {e.stderr.decode() if e.stderr else str(e)}")
            return None
        except Exception as e:
            logger.warning(f"imagesnap拍照失败: {e}")
            return None