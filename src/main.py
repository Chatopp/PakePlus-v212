"""
自习监督程序主模块

监控自习时段的噪音水平，当噪音超过阈值时自动拍照记录。
"""
import os
import sys
import time
import csv
import logging
import pathlib
import datetime
from typing import Optional

from noise import NoiseMonitor
from camera import Camera


# 配置常量
MORNING_START = "06:30"
MORNING_END = "07:30"
EVENING_START = "19:00"
EVENING_END = "21:00"
COOLDOWN_SECONDS = 10.0
INACTIVE_SLEEP_SECONDS = 1.0

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data/monitor.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


class TimeWindow:
    """时间窗口管理类，优化时间解析性能"""
    
    def __init__(self, morning_start: str, morning_end: str, 
                 evening_start: str, evening_end: str):
        """初始化时间窗口
        
        Args:
            morning_start: 早自习开始时间 (HH:MM格式)
            morning_end: 早自习结束时间 (HH:MM格式)
            evening_start: 晚自习开始时间 (HH:MM格式)
            evening_end: 晚自习结束时间 (HH:MM格式)
        """
        self.morning_start_time = datetime.datetime.strptime(morning_start, "%H:%M").time()
        self.morning_end_time = datetime.datetime.strptime(morning_end, "%H:%M").time()
        self.evening_start_time = datetime.datetime.strptime(evening_start, "%H:%M").time()
        self.evening_end_time = datetime.datetime.strptime(evening_end, "%H:%M").time()
    
    def in_window(self, now: datetime.datetime) -> tuple[bool, Optional[str]]:
        """判断当前时间是否在监控窗口内
        
        Args:
            now: 当前时间
            
        Returns:
            (是否在窗口内, 窗口名称)
        """
        current_time = now.time()
        current_date = now.date()
        
        # 检查早自习时段
        if self.morning_start_time <= current_time <= self.morning_end_time:
            return True, "早自习"
        
        # 检查晚自习时段
        if self.evening_start_time <= current_time <= self.evening_end_time:
            return True, "晚自习"
        
        return False, None


def ensure_dirs():
    """确保必要的目录存在"""
    try:
        pathlib.Path("data").mkdir(parents=True, exist_ok=True)
        pathlib.Path("data/photos").mkdir(parents=True, exist_ok=True)
    except OSError as e:
        logger.error(f"创建目录失败: {e}")
        raise


def log_event(ts: datetime.datetime, db: float, window: Optional[str], 
              photo_path: Optional[str]) -> None:
    """记录事件到CSV文件
    
    Args:
        ts: 时间戳
        db: 分贝值
        window: 窗口名称
        photo_path: 照片路径
    """
    try:
        ensure_dirs()
        csv_path = os.path.join("data", "incidents.csv")
        file_exists = os.path.exists(csv_path)
        
        with open(csv_path, "a", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            if not file_exists:
                writer.writerow(["timestamp", "window", "db", "photo"])
            writer.writerow([
                ts.isoformat(),
                window or "",
                f"{db:.2f}",
                photo_path or ""
            ])
        
        logger.info(f"事件已记录: {window} - {db:.2f}dB - {photo_path}")
    except Exception as e:
        logger.error(f"记录事件失败: {e}", exc_info=True)


def run():
    """主运行函数"""
    try:
        ensure_dirs()
        logger.info("启动自习监督程序")
        
        # 初始化组件
        monitor = NoiseMonitor()
        cam = Camera()
        time_window = TimeWindow(
            MORNING_START, MORNING_END,
            EVENING_START, EVENING_END
        )
        
        # 运行状态
        noisy_since: Optional[float] = None
        last_event = 0.0
        cooldown = COOLDOWN_SECONDS
        test_mode = os.getenv("TEST_MODE") == "1"
        
        if test_mode:
            logger.info("测试模式：10秒后自动退出")
            end_time = time.time() + 10.0
        else:
            end_time = float('inf')
        
        logger.info(f"监控时段: {MORNING_START}-{MORNING_END}, {EVENING_START}-{EVENING_END}")
        logger.info(f"噪音阈值: {monitor.threshold_db}dB, 持续时长: {monitor.min_duration}秒")
        
        # 主循环
        while time.time() < end_time:
            try:
                now = datetime.datetime.now()
                active, window = time_window.in_window(now)
                
                if not active:
                    time.sleep(INACTIVE_SLEEP_SECONDS)
                    continue
                
                # 测量噪音
                db = monitor.measure_db()
                
                if db is None:
                    logger.warning("无法测量噪音，跳过本次检测")
                    time.sleep(monitor.sleep_interval())
                    continue
                
                # 判断是否噪音
                if monitor.is_noisy(db):
                    if noisy_since is None:
                        noisy_since = time.time()
                        logger.debug(f"检测到噪音: {db:.2f}dB")
                else:
                    noisy_since = None
                
                # 处理噪音事件
                current_time = time.time()
                if noisy_since is not None:
                    duration = current_time - noisy_since
                    if duration >= monitor.min_duration:
                        if current_time - last_event >= cooldown:
                            logger.warning(f"噪音事件触发: {db:.2f}dB (持续{duration:.1f}秒)")
                            
                            # 拍照
                            photo_path = cam.capture(tag="noisy")
                            if photo_path:
                                logger.info(f"照片已保存: {photo_path}")
                            else:
                                logger.warning("拍照失败")
                            
                            # 记录事件
                            log_event(now, db, window, photo_path)
                            
                            last_event = current_time
                            noisy_since = None
                
                time.sleep(monitor.sleep_interval())
                
            except KeyboardInterrupt:
                logger.info("收到中断信号，正在退出...")
                break
            except Exception as e:
                logger.error(f"主循环错误: {e}", exc_info=True)
                time.sleep(1.0)  # 发生错误时短暂休眠
        
        logger.info("程序正常退出")
        
    except Exception as e:
        logger.error(f"程序启动失败: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    run()