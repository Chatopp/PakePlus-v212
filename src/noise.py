"""
噪音监控模块

提供噪音测量和判断功能，使用麦克风实时监测环境噪音水平。
"""
import math
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class NoiseMonitor:
    """噪音监控类"""
    
    def __init__(self, threshold_db: float = 65.0, min_duration: float = 2.0, 
                 sample_rate: int = 16000, frame_ms: int = 200):
        """初始化噪音监控器
        
        Args:
            threshold_db: 噪音阈值（分贝），超过此值视为噪音
            min_duration: 噪音持续时长（秒），超过此时长才触发事件
            sample_rate: 采样率（Hz）
            frame_ms: 采样帧长度（毫秒）
        """
        if threshold_db < 0 or threshold_db > 120:
            raise ValueError(f"阈值应在0-120dB之间，当前值: {threshold_db}")
        if min_duration < 0:
            raise ValueError(f"持续时长不能为负数，当前值: {min_duration}")
        if sample_rate <= 0:
            raise ValueError(f"采样率必须大于0，当前值: {sample_rate}")
        if frame_ms <= 0:
            raise ValueError(f"帧长度必须大于0，当前值: {frame_ms}")
        
        self.threshold_db = threshold_db
        self.min_duration = min_duration
        self.sample_rate = sample_rate
        self.frame_ms = frame_ms
        
        # 检查依赖
        self._check_dependencies()
    
    def _check_dependencies(self) -> None:
        """检查必要的依赖库"""
        try:
            import numpy as np
            import sounddevice as sd
            self.has_dependencies = True
            logger.info("噪音监控依赖检查通过")
        except ImportError as e:
            self.has_dependencies = False
            logger.error(f"缺少必要的依赖库: {e}")
            logger.error("请安装: pip install numpy sounddevice")
    
    def measure_db(self) -> Optional[float]:
        """测量当前环境噪音分贝值
        
        Returns:
            分贝值，测量失败返回None
        """
        if not self.has_dependencies:
            logger.warning("依赖库未安装，无法测量噪音")
            return None
        
        try:
            import numpy as np
            import sounddevice as sd
            
            # 计算采样帧数
            frames = int(self.sample_rate * (self.frame_ms / 1000))
            if frames <= 0:
                logger.warning(f"无效的帧数: {frames}")
                return None
            
            # 录制音频
            data = sd.rec(
                frames,
                samplerate=self.sample_rate,
                channels=1,
                dtype="float32"
            )
            sd.wait()
            
            if data is None or len(data) == 0:
                logger.warning("录音数据为空")
                return None
            
            # 计算RMS（均方根）
            rms = float(np.sqrt(np.mean(np.square(data))))
            
            if rms <= 0:
                return 0.0
            
            # 转换为分贝值
            # 公式: dB = 20 * log10(rms) + 94
            # 94是参考值，将RMS转换为分贝
            db = 20.0 * math.log10(rms) + 94.0
            
            # 限制分贝值在合理范围内
            db = max(0.0, min(db, 120.0))
            
            return db
            
        except Exception as e:
            logger.warning(f"测量噪音失败: {e}")
            return None
    
    def is_noisy(self, db: Optional[float]) -> bool:
        """判断当前噪音是否超过阈值
        
        Args:
            db: 分贝值
            
        Returns:
            如果超过阈值返回True，否则返回False
        """
        if db is None:
            return False
        return db >= self.threshold_db
    
    def sleep_interval(self) -> float:
        """获取采样间隔时间（秒）
        
        Returns:
            采样间隔时间，最小0.05秒
        """
        interval = max(self.frame_ms / 1000.0, 0.05)
        return interval