// 获取默认时间限制
function getDefaultTimeLimits() {
    return {
        signIn1: { endHour: 9, endMinute: 0 },
        signIn2: { endHour: 15, endMinute: 0 },
        signOut1: { startHour: 11, startMinute: 0, endHour: 23, endMinute: 59 },
        signOut2: { startHour: 16, startMinute: 45, endHour: 23, endMinute: 59 }
    };
}

// 活动数据存储（使用localStorage）
// 数据结构：[{ id: "activity-1", name: "晨会", createdAt: "2024-01-01", color: "#667eea", timeLimits: {...} }, ...]
let activities = JSON.parse(localStorage.getItem('activities')) || [];

// 当前选中的活动ID
let currentActivityId = localStorage.getItem('currentActivityId') || null;

// 如果没有活动，创建一个默认活动
if (activities.length === 0) {
    const defaultActivity = {
        id: 'activity-' + Date.now(),
        name: '默认活动',
        createdAt: new Date().toISOString(),
        color: '#667eea',
        timeLimits: getDefaultTimeLimits(),
        students: [] // 活动关联的学生列表（空数组表示使用全局学生列表）
    };
    activities.push(defaultActivity);
    currentActivityId = defaultActivity.id;
    localStorage.setItem('activities', JSON.stringify(activities));
    localStorage.setItem('currentActivityId', currentActivityId);
}

// 确保当前活动ID有效
if (!currentActivityId || !activities.find(a => a.id === currentActivityId)) {
    currentActivityId = activities[0].id;
    localStorage.setItem('currentActivityId', currentActivityId);
}

// 确保所有活动都有时间限制和学生列表（兼容旧数据）
activities.forEach(activity => {
    if (!activity.timeLimits) {
        activity.timeLimits = getDefaultTimeLimits();
    }
    if (!activity.students) {
        activity.students = []; // 空数组表示使用全局学生列表
    }
});
localStorage.setItem('activities', JSON.stringify(activities));

// 获取当前活动的学生列表
function getCurrentStudents() {
    const currentActivity = activities.find(a => a.id === currentActivityId);
    if (!currentActivity) return studentsData;
    
    // 如果活动有自定义学生列表，使用活动的；否则使用全局的
    if (currentActivity.students && currentActivity.students.length > 0) {
        return currentActivity.students;
    }
    return studentsData;
}

// 签到数据存储（使用localStorage）
// 新数据结构：{ "activityId-idCard": [{ date: "2024-01-01", signIns: [...], signOuts: [...] }, ...] }
let signData = JSON.parse(localStorage.getItem('signData')) || {};

// 设定的签到日期列表
let signDates = JSON.parse(localStorage.getItem('signDates')) || [];

// 获取当前活动的时间限制
function getCurrentTimeLimits() {
    const currentActivity = activities.find(a => a.id === currentActivityId);
    return currentActivity?.timeLimits || getDefaultTimeLimits();
}

// 当前活动的时间限制（动态获取）
let timeLimits = getCurrentTimeLimits();

// 当前日期（始终使用今天）
let currentDate = getTodayDate();

// 获取当前活动的签到数据key
function getSignDataKey(idCard) {
    return `${currentActivityId}-${idCard}`;
}

// 获取今天的日期字符串（YYYY-MM-DD格式）
function getTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// 获取日期字符串（YYYY-MM-DD格式）
function getDateString(date) {
    if (date instanceof Date) {
        return date.toISOString().split('T')[0];
    }
    return date;
}

// 格式化日期显示
function formatDateDisplay(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    return `${month}月${day}日 ${weekday}`;
}

// 初始化应用
function init() {
    console.log('系统初始化...');
    console.log('活动列表:', activities);
    console.log('当前活动ID:', currentActivityId);
    
    setupActivitySelector();
    setupDateSelector();
    renderStudents();
    updateStats();
    setupFilterButtons();
    
    console.log('系统初始化完成');
}

// 全局错误处理
window.addEventListener('error', function(event) {
    console.error('全局错误:', event.error);
    showNotification('发生错误: ' + event.error.message, 'error');
});

// 设置活动选择器
function setupActivitySelector() {
    const container = document.getElementById('activity-selector');
    if (!container) return;
    
    const currentActivity = activities.find(a => a.id === currentActivityId);
    
    container.innerHTML = `
        <div class="activity-selector-header">
            <div class="activity-selector-title">
                <span class="activity-icon">🎯</span>
                <span>当前活动：</span>
            </div>
            <button class="manage-activities-btn" onclick="showActivitiesManageModal()">
                管理活动
            </button>
        </div>
        <div class="activity-buttons-container">
            ${activities.map(activity => `
                <button class="activity-btn ${activity.id === currentActivityId ? 'active' : ''}" 
                        data-activity-id="${activity.id}"
                        onclick="selectActivity('${activity.id}')"
                        style="border-color: ${activity.color}; ${activity.id === currentActivityId ? `background: ${activity.color};` : ''}">
                    ${activity.name}
                </button>
            `).join('')}
        </div>
    `;
}

// 选择活动
function selectActivity(activityId) {
    if (currentActivityId === activityId) return;
    
    currentActivityId = activityId;
    localStorage.setItem('currentActivityId', currentActivityId);
    
    // 更新当前活动的时间限制
    timeLimits = getCurrentTimeLimits();
    
    // 重新渲染界面
    setupActivitySelector();
    renderStudents(getCurrentFilter());
    updateStats();
    
    const activity = activities.find(a => a.id === activityId);
    showNotification(`已切换到活动：${activity.name}`, 'success');
}

// 显示活动管理模态框
function showActivitiesManageModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'activities-manage-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.maxWidth = '600px';
    
    const activityColors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#30cfd0', '#a8edea', '#f5576c'];
    
    // 创建模态框头部
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
        <h2>🎯 活动管理</h2>
        <button class="modal-close" onclick="closeActivitiesManageModal()">&times;</button>
    `;
    
    // 创建模态框主体
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    // 创建新建活动区域
    const addSection = document.createElement('div');
    addSection.className = 'add-activity-section';
    addSection.innerHTML = `
        <h3>新建活动</h3>
        <div class="activity-input-group">
            <input type="text" 
                   id="new-activity-name" 
                   class="activity-name-input" 
                   placeholder="输入活动名称，如：晨会、培训、讲座等"
                   maxlength="20">
            <div class="activity-color-picker">
                ${activityColors.map(color => `
                    <div class="color-option ${color === '#667eea' ? 'selected' : ''}" 
                         data-color="${color}"
                         style="background: ${color}"
                         onclick="selectActivityColor(this)"></div>
                `).join('')}
            </div>
            <button class="add-activity-btn" onclick="addNewActivity()">
                ✚ 创建活动
            </button>
        </div>
    `;
    
    // 创建活动列表区域
    const listSection = document.createElement('div');
    listSection.className = 'activities-list-section';
    
    const listTitle = document.createElement('h3');
    listTitle.textContent = '活动列表';
    listSection.appendChild(listTitle);
    
    const activitiesList = document.createElement('div');
    activitiesList.className = 'activities-list';
    activitiesList.id = 'activities-list';
    
    // 为每个活动创建DOM元素
    activities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.setAttribute('data-activity-id', activity.id);
        
        const isCurrentActivity = activity.id === currentActivityId;
        const canDelete = activities.length > 1;
        const studentCountText = activity.students?.length || '使用全局';
        
        // 活动颜色标识
        const colorDiv = document.createElement('div');
        colorDiv.className = 'activity-item-color';
        colorDiv.style.background = activity.color;
        
        // 活动信息
        const infoDiv = document.createElement('div');
        infoDiv.className = 'activity-item-info';
        infoDiv.innerHTML = `
            <div class="activity-item-name">${activity.name}</div>
            <div class="activity-item-meta">
                ${isCurrentActivity ? '<span class="current-badge">当前</span>' : ''}
                <span class="activity-item-date">创建于 ${new Date(activity.createdAt).toLocaleDateString('zh-CN')}</span>
                <span class="activity-item-students">👥 ${studentCountText} 人</span>
            </div>
        `;
        
        // 操作按钮容器
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'activity-item-actions';
        
        // 管理名单按钮
        const manageBtn = document.createElement('button');
        manageBtn.className = 'activity-action-btn manage-btn';
        manageBtn.textContent = '管理名单';
        manageBtn.onclick = function(e) {
            e.stopPropagation();
            console.log('管理名单点击:', activity.id);
            showStudentManageModal(activity.id);
        };
        actionsDiv.appendChild(manageBtn);
        
        // 重命名按钮
        const renameBtn = document.createElement('button');
        renameBtn.className = 'activity-action-btn rename-btn';
        renameBtn.textContent = '重命名';
        renameBtn.onclick = function(e) {
            e.stopPropagation();
            console.log('重命名点击:', activity.id);
            showRenameActivityModal(activity.id);
        };
        actionsDiv.appendChild(renameBtn);
        
        // 切换按钮（非当前活动才显示）
        if (!isCurrentActivity) {
            const switchBtn = document.createElement('button');
            switchBtn.className = 'activity-action-btn switch-btn';
            switchBtn.textContent = '切换';
            switchBtn.onclick = function(e) {
                e.stopPropagation();
                console.log('切换活动点击:', activity.id);
                selectActivity(activity.id);
                closeActivitiesManageModal();
            };
            actionsDiv.appendChild(switchBtn);
        }
        
        // 删除按钮（多于1个活动才显示）
        if (canDelete) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'activity-action-btn delete-btn';
            deleteBtn.textContent = '删除';
            deleteBtn.onclick = function(e) {
                e.stopPropagation();
                console.log('删除按钮点击:', activity.id);
                deleteActivity(activity.id);
            };
            actionsDiv.appendChild(deleteBtn);
        }
        
        // 组装活动项
        activityItem.appendChild(colorDiv);
        activityItem.appendChild(infoDiv);
        activityItem.appendChild(actionsDiv);
        
        activitiesList.appendChild(activityItem);
    });
    
    listSection.appendChild(activitiesList);
    
    // 组装模态框主体
    modalBody.appendChild(addSection);
    modalBody.appendChild(listSection);
    
    // 创建模态框底部
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';
    modalFooter.innerHTML = `
        <button class="modal-btn confirm-btn" onclick="closeActivitiesManageModal()">完成</button>
    `;
    
    // 组装模态框
    modal.appendChild(modalHeader);
    modal.appendChild(modalBody);
    modal.appendChild(modalFooter);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 点击遮罩关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeActivitiesManageModal();
        }
    });
    
    console.log('活动管理模态框已创建，共有', activities.length, '个活动');
}

// 选择活动颜色
function selectActivityColor(element) {
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

// 添加新活动
function addNewActivity() {
    const nameInput = document.getElementById('new-activity-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        showNotification('请输入活动名称', 'warning');
        return;
    }
    
    if (activities.some(a => a.name === name)) {
        showNotification('活动名称已存在', 'warning');
        return;
    }
    
    const selectedColor = document.querySelector('.color-option.selected');
    const color = selectedColor ? selectedColor.getAttribute('data-color') : '#667eea';
    
    const newActivity = {
        id: 'activity-' + Date.now(),
        name: name,
        createdAt: new Date().toISOString(),
        color: color,
        timeLimits: getDefaultTimeLimits(), // 新活动使用默认时间限制
        students: [] // 空数组表示使用全局学生列表
    };
    
    activities.push(newActivity);
    localStorage.setItem('activities', JSON.stringify(activities));
    
    // 刷新活动管理界面
    closeActivitiesManageModal();
    showActivitiesManageModal();
    
    showNotification(`活动"${name}"已创建`, 'success');
}

// 显示重命名活动模态框
function showRenameActivityModal(activityId) {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) {
        console.error('Activity not found for rename:', activityId);
        showNotification('未找到该活动', 'error');
        return;
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'rename-activity-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.maxWidth = '480px';
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2>✏️ 重命名活动</h2>
            <button class="modal-close" onclick="closeRenameActivityModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="rename-activity-notice">
                <span class="notice-icon">ℹ️</span>
                <span>为活动"<strong>${activity.name}</strong>"设置新的名称（1-20个字符）</span>
            </div>
            <div class="rename-activity-input-group">
                <label for="rename-activity-input">活动名称</label>
                <input type="text" 
                       id="rename-activity-input" 
                       class="activity-name-input" 
                       value="${activity.name}"
                       maxlength="20"
                       placeholder="请输入活动名称">
                <div class="rename-activity-error" id="rename-activity-error"></div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="modal-btn cancel-btn" onclick="closeRenameActivityModal()">取消</button>
            <button class="modal-btn confirm-btn" onclick="confirmRenameActivity('${activityId}')">保存</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeRenameActivityModal();
        }
    });
    
    // 自动聚焦输入框
    setTimeout(() => {
        const input = document.getElementById('rename-activity-input');
        if (input) {
            input.focus();
            input.select();
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmRenameActivity(activityId);
                }
            });
        }
    }, 0);
}

function closeRenameActivityModal() {
    const overlay = document.getElementById('rename-activity-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
}

function confirmRenameActivity(activityId) {
    const input = document.getElementById('rename-activity-input');
    const errorEl = document.getElementById('rename-activity-error');
    if (!input || !errorEl) {
        showNotification('系统错误：未找到输入框', 'error');
        return;
    }
    
    const newName = input.value.trim();
    errorEl.textContent = '';
    
    if (newName.length === 0) {
        errorEl.textContent = '活动名称不能为空';
        input.focus();
        return;
    }
    
    if (newName.length > 20) {
        errorEl.textContent = '活动名称不能超过20个字符';
        input.focus();
        return;
    }
    
    const activity = activities.find(a => a.id === activityId);
    if (!activity) {
        showNotification('未找到该活动', 'error');
        closeRenameActivityModal();
        return;
    }
    
    if (newName === activity.name) {
        showNotification('活动名称未发生变化', 'warning');
        closeRenameActivityModal();
        return;
    }
    
    const nameExists = activities.some(a => a.id !== activityId && a.name === newName);
    if (nameExists) {
        errorEl.textContent = '已存在同名活动，请更换名称';
        input.focus();
        return;
    }
    
    activity.name = newName;
    localStorage.setItem('activities', JSON.stringify(activities));
    
    // 刷新 UI
    setupActivitySelector();
    renderStudents(getCurrentFilter());
    updateStats();
    
    closeRenameActivityModal();
    closeActivitiesManageModal();
    showActivitiesManageModal();
    
    showNotification(`活动名称已更新为：${newName}`, 'success');
}

// 删除活动
function deleteActivity(activityId) {
    console.log('deleteActivity called with:', activityId);
    console.log('Current activities:', activities);
    
    if (activities.length <= 1) {
        showNotification('至少需要保留一个活动', 'warning');
        return;
    }
    
    const activity = activities.find(a => a.id === activityId);
    if (!activity) {
        console.error('Activity not found:', activityId);
        showNotification('未找到该活动', 'error');
        return;
    }
    
    if (!confirm(`确定要删除活动"${activity.name}"吗？\n\n删除后该活动的所有签到数据将被清除且无法恢复！`)) {
        return;
    }
    
    // 删除活动
    activities = activities.filter(a => a.id !== activityId);
    localStorage.setItem('activities', JSON.stringify(activities));
    
    // 删除该活动的所有签到数据
    Object.keys(signData).forEach(key => {
        if (key.startsWith(activityId + '-')) {
            delete signData[key];
        }
    });
    localStorage.setItem('signData', JSON.stringify(signData));
    
    // 如果删除的是当前活动，切换到第一个活动
    if (currentActivityId === activityId) {
        currentActivityId = activities[0].id;
        localStorage.setItem('currentActivityId', currentActivityId);
        
        // 更新时间限制
        timeLimits = getCurrentTimeLimits();
        
        setupActivitySelector();
        renderStudents(getCurrentFilter());
        updateStats();
    }
    
    // 刷新活动管理界面
    closeActivitiesManageModal();
    showActivitiesManageModal();
    
    showNotification(`活动"${activity.name}"已删除`, 'success');
}

// 关闭活动管理模态框
function closeActivitiesManageModal() {
    const overlay = document.getElementById('activities-manage-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
    // 刷新活动选择器
    setupActivitySelector();
}

// 显示学生名单管理模态框
function showStudentManageModal(activityId) {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'student-manage-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.maxWidth = '700px';
    
    const studentCount = activity.students?.length || 0;
    const useGlobal = studentCount === 0;
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2>👥 学生名单 - ${activity.name}</h2>
            <button class="modal-close" onclick="closeStudentManageModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="student-manage-notice">
                <span class="notice-icon">💡</span>
                <span>每个活动可以有独立的学生名单，留空则使用全局名单（${studentsData.length}人）</span>
            </div>
            
            <div class="student-count-info">
                <span class="count-label">当前名单：</span>
                <span class="count-value">${useGlobal ? '使用全局名单' : `${studentCount} 人`}</span>
            </div>
            
            <div class="import-methods">
                <h3>导入方式</h3>
                <div class="import-tabs">
                    <button class="import-tab active" onclick="switchImportTab('paste')">📋 粘贴导入</button>
                    <button class="import-tab" onclick="switchImportTab('file')">📁 文件导入</button>
                    <button class="import-tab" onclick="switchImportTab('global')">🌐 使用全局</button>
                </div>
                
                <div class="import-content">
                    <div class="import-panel" id="paste-panel">
                        <label class="import-label">粘贴学生信息（每行一个学生，格式：姓名,身份证号）</label>
                        <textarea id="student-paste-input" 
                                  class="student-paste-input" 
                                  placeholder="示例：&#10;张三,320102199001011234&#10;李四,320102199002022345&#10;王五,320102199003033456"
                                  rows="10"></textarea>
                        <button class="import-action-btn" onclick="importFromPaste('${activityId}')">
                            导入名单
                        </button>
                    </div>
                    
                    <div class="import-panel hidden" id="file-panel">
                        <label class="import-label">选择CSV或Excel文件（需包含"姓名"和"身份证号"列）</label>
                        <input type="file" 
                               id="student-file-input" 
                               class="student-file-input"
                               accept=".csv,.xlsx,.xls"
                               onchange="importFromFile('${activityId}', this)">
                        <div class="file-hint">
                            支持格式：CSV、Excel (.xlsx, .xls)
                        </div>
                    </div>
                    
                    <div class="import-panel hidden" id="global-panel">
                        <div class="global-panel-info">
                            <p>使用全局学生名单（${studentsData.length}人）</p>
                            <p class="global-hint">此活动将使用系统的全局学生名单，不单独维护学生列表</p>
                        </div>
                        <button class="import-action-btn" onclick="useGlobalStudents('${activityId}')">
                            使用全局名单
                        </button>
                    </div>
                </div>
            </div>
            
            ${!useGlobal ? `
                <div class="current-students-section">
                    <h3>当前名单（${studentCount}人）</h3>
                    <div class="students-list-display">
                        ${activity.students.map((student, index) => `
                            <div class="student-list-item">
                                <span class="student-index">${index + 1}</span>
                                <span class="student-name">${student.name}</span>
                                <span class="student-id">${student.idCard}</span>
                                <button class="remove-student-btn" onclick="removeStudent('${activityId}', ${index})">
                                    ✕
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
        <div class="modal-footer">
            <button class="modal-btn cancel-btn" onclick="closeStudentManageModal(); showActivitiesManageModal();">
                返回
            </button>
            <button class="modal-btn confirm-btn" onclick="closeStudentManageModal()">
                完成
            </button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeStudentManageModal();
        }
    });
}

// 切换导入标签页
function switchImportTab(tabName) {
    // 更新标签按钮状态
    document.querySelectorAll('.import-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // 显示对应面板
    document.querySelectorAll('.import-panel').forEach(panel => {
        panel.classList.add('hidden');
    });
    document.getElementById(tabName + '-panel').classList.remove('hidden');
}

// 从粘贴文本导入
function importFromPaste(activityId) {
    const textarea = document.getElementById('student-paste-input');
    const text = textarea.value.trim();
    
    if (!text) {
        showNotification('请输入学生信息', 'warning');
        return;
    }
    
    const lines = text.split('\n').filter(line => line.trim());
    const students = [];
    const errors = [];
    
    lines.forEach((line, index) => {
        const parts = line.split(/[,，\t]/).map(p => p.trim());
        if (parts.length >= 2) {
            const name = parts[0];
            const idCard = parts[1];
            
            if (name && idCard) {
                // 简单验证身份证号（15或18位）
                if (idCard.length === 15 || idCard.length === 18) {
                    students.push({ name, idCard });
                } else {
                    errors.push(`第${index + 1}行：身份证号格式错误`);
                }
            } else {
                errors.push(`第${index + 1}行：数据不完整`);
            }
        } else {
            errors.push(`第${index + 1}行：格式错误`);
        }
    });
    
    if (errors.length > 0) {
        showNotification(`导入完成，但有${errors.length}行数据格式错误`, 'warning');
        console.log('导入错误:', errors);
    }
    
    if (students.length === 0) {
        showNotification('没有成功导入任何学生数据', 'error');
        return;
    }
    
    // 保存到活动
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
        activity.students = students;
        localStorage.setItem('activities', JSON.stringify(activities));
        
        showNotification(`成功导入 ${students.length} 名学生`, 'success');
        
        // 如果是当前活动，刷新界面
        if (activityId === currentActivityId) {
            renderStudents(getCurrentFilter());
            updateStats();
        }
        
        // 刷新模态框
        closeStudentManageModal();
        setTimeout(() => showStudentManageModal(activityId), 100);
    }
}

// 从文件导入（简化版，支持CSV）
function importFromFile(activityId, input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const text = e.target.result;
        
        // 简单的CSV解析
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
            showNotification('文件为空', 'error');
            return;
        }
        
        // 跳过表头
        const dataLines = lines.slice(1);
        const students = [];
        
        dataLines.forEach(line => {
            const parts = line.split(/[,\t]/).map(p => p.trim().replace(/^"|"$/g, ''));
            if (parts.length >= 2) {
                const name = parts[0];
                const idCard = parts[1];
                
                if (name && idCard && (idCard.length === 15 || idCard.length === 18)) {
                    students.push({ name, idCard });
                }
            }
        });
        
        if (students.length === 0) {
            showNotification('未能从文件中解析出有效数据', 'error');
            return;
        }
        
        // 保存到活动
        const activity = activities.find(a => a.id === activityId);
        if (activity) {
            activity.students = students;
            localStorage.setItem('activities', JSON.stringify(activities));
            
            showNotification(`成功从文件导入 ${students.length} 名学生`, 'success');
            
            // 如果是当前活动，刷新界面
            if (activityId === currentActivityId) {
                renderStudents(getCurrentFilter());
                updateStats();
            }
            
            // 刷新模态框
            closeStudentManageModal();
            setTimeout(() => showStudentManageModal(activityId), 100);
        }
    };
    
    reader.readAsText(file, 'UTF-8');
}

// 使用全局学生名单
function useGlobalStudents(activityId) {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
        activity.students = []; // 空数组表示使用全局
        localStorage.setItem('activities', JSON.stringify(activities));
        
        showNotification('已设置为使用全局学生名单', 'success');
        
        // 如果是当前活动，刷新界面
        if (activityId === currentActivityId) {
            renderStudents(getCurrentFilter());
            updateStats();
        }
        
        // 刷新模态框
        closeStudentManageModal();
        setTimeout(() => showStudentManageModal(activityId), 100);
    }
}

// 移除单个学生
function removeStudent(activityId, index) {
    const activity = activities.find(a => a.id === activityId);
    if (!activity || !activity.students) return;
    
    const student = activity.students[index];
    if (!confirm(`确定要从活动"${activity.name}"中移除学生"${student.name}"吗？`)) {
        return;
    }
    
    activity.students.splice(index, 1);
    localStorage.setItem('activities', JSON.stringify(activities));
    
    showNotification(`已移除学生"${student.name}"`, 'success');
    
    // 如果是当前活动，刷新界面
    if (activityId === currentActivityId) {
        renderStudents(getCurrentFilter());
        updateStats();
    }
    
    // 刷新模态框
    closeStudentManageModal();
    setTimeout(() => showStudentManageModal(activityId), 100);
}

// 关闭学生管理模态框
function closeStudentManageModal() {
    const overlay = document.getElementById('student-manage-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// 获取时间限制（转换为分钟数便于比较）
function getTimeLimit(type, isStart = false) {
    const limit = timeLimits[type];
    if (!limit) return 0;
    // 签到只有结束时间
    if (type === 'signIn1' || type === 'signIn2') {
        return limit.endHour * 60 + limit.endMinute;
    }
    // 签退有开始时间和结束时间
    if (isStart) {
        return limit.startHour * 60 + limit.startMinute;
    } else {
        return limit.endHour * 60 + limit.endMinute;
    }
}

// 设置日期选择器（显示当前日期）
function setupDateSelector() {
    const dateSelector = document.getElementById('date-selector');
    if (!dateSelector) return;
    
    // 直接显示今天的日期
    const today = getTodayDate();
    dateSelector.innerHTML = `
        <div class="date-selector-header">
            <span class="date-selector-title">签到日期：${formatDateDisplay(today)} (今天)</span>
        </div>
    `;
}

// 不再需要日期选择功能

// 渲染学生卡片
function renderStudents(filter = 'all') {
    const grid = document.getElementById('students-grid');
    if (!grid) {
        console.error('找不到students-grid元素');
        return;
    }
    
    console.log('渲染学生列表 - 日期:', currentDate, '筛选:', filter);
    
    grid.innerHTML = '';
    
    // 确保使用今天的日期
    currentDate = getTodayDate();
    
    // 获取当前活动的学生数据
    const currentStudents = getCurrentStudents();
    
    // 检查学生数据
    if (!currentStudents || currentStudents.length === 0) {
        grid.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">暂无学生数据，请在活动管理中导入名单</p>';
        return;
    }
    
    let filteredStudents = currentStudents;
    
    // 获取当前日期下已签到的学生（支持多次签到）
    const signedStudents = currentStudents.filter(s => {
        const records = signData[getSignDataKey(s.idCard)] || [];
        const todayRecord = records.find(r => r.date === currentDate);
        if (todayRecord) {
            const signIns = Array.isArray(todayRecord.signIns) ? todayRecord.signIns : (todayRecord.signIn ? [todayRecord.signIn] : []);
            return signIns.length > 0;
        }
        return false;
    });
    
    if (filter === 'signed') {
        filteredStudents = signedStudents;
    } else if (filter === 'unsigned') {
        filteredStudents = currentStudents.filter(s => {
            const records = signData[getSignDataKey(s.idCard)] || [];
            const todayRecord = records.find(r => r.date === currentDate);
            if (todayRecord) {
                const signIns = Array.isArray(todayRecord.signIns) ? todayRecord.signIns : (todayRecord.signIn ? [todayRecord.signIn] : []);
                return signIns.length === 0;
            }
            return true;
        });
    }
    
    filteredStudents.forEach(student => {
        try {
            const card = createStudentCard(student);
            if (card) {
                grid.appendChild(card);
            }
        } catch (error) {
            console.error('创建学生卡片失败:', error, student);
        }
    });
}

// 创建学生卡片
function createStudentCard(student) {
    if (!student || !student.idCard) {
        console.error('无效的学生数据:', student);
        return null;
    }
    
    const card = document.createElement('div');
    const records = signData[getSignDataKey(student.idCard)] || [];
    const todayRecord = records.find(r => r.date === currentDate);
    
    // 获取今天的签到和签退记录（支持多次）
    const signIns = todayRecord ? (Array.isArray(todayRecord.signIns) ? todayRecord.signIns : (todayRecord.signIn ? [todayRecord.signIn] : [])) : [];
    const signOuts = todayRecord ? (Array.isArray(todayRecord.signOuts) ? todayRecord.signOuts : (todayRecord.signOut ? [todayRecord.signOut] : [])) : [];
    
    const signInCount = signIns.length;
    const signOutCount = signOuts.length;
    const totalSignInCount = records.reduce((sum, r) => {
        const ins = Array.isArray(r.signIns) ? r.signIns : (r.signIn ? [r.signIn] : []);
        return sum + ins.length;
    }, 0);
    
    // 判断状态（签到和签退独立）
    const isCompleted = signInCount >= 2 && signOutCount >= 2;
    const hasAnySignIn = signInCount > 0;
    const hasAnySignOut = signOutCount > 0;
    
    // 卡片样式：有任意签到或签退记录就显示为已操作状态
    card.className = `student-card ${hasAnySignIn || hasAnySignOut ? 'signed' : ''}`;
    
    // 显示所有签到和签退时间
    let timeInfo = '';
    signIns.forEach((time, index) => {
        timeInfo += `<div class="sign-time-container">
            <span class="sign-time-label">签到${index + 1}：</span>
            <span class="sign-time">${time}</span>
        </div>`;
    });
    signOuts.forEach((time, index) => {
        timeInfo += `<div class="sign-time-container sign-out">
            <span class="sign-time-label">签退${index + 1}：</span>
            <span class="sign-time">${time}</span>
        </div>`;
    });
    
    // 按钮逻辑：签到和签退独立，各自最多2次
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    let signInButtonHtml = '';
    let signOutButtonHtml = '';
    
    // 签到按钮（根据时间段判断）
    if (signInCount < 2) {
        let buttonText = '签到';
        let isDisabled = false;
        
        // 判断当前是上午还是下午
        const noonTime = 12 * 60; // 12:00 作为上下午分界点
        const isAfternoon = currentTime >= noonTime;
        
        if (isAfternoon) {
            // 下午：使用第二次签到的时间限制
            const endTime = getTimeLimit('signIn2', false);
            if (currentTime >= endTime) {
                buttonText = '签到(已超时)';
                isDisabled = true;
            }
        } else {
            // 上午：使用第一次签到的时间限制
            const endTime = getTimeLimit('signIn1', false);
            if (currentTime >= endTime) {
                buttonText = '签到(已超时)';
                isDisabled = true;
            }
        }
        
        signInButtonHtml = `<button class="sign-btn ${isDisabled ? 'disabled' : ''}" 
                            ${isDisabled ? '' : `onclick="handleSign('${student.idCard}', 'signIn')"`} 
                            ${isDisabled ? 'disabled' : ''}>${buttonText}</button>`;
    } else {
        signInButtonHtml = `<button class="sign-btn signed" disabled>签到完成</button>`;
    }
    
    // 签退按钮（根据时间段判断）
    if (signOutCount < 2) {
        let buttonText = '签退';
        let isDisabled = false;
        
        // 判断当前是上午还是下午
        const noonTime = 12 * 60; // 12:00 作为上下午分界点
        const isAfternoon = currentTime >= noonTime;
        
        if (isAfternoon) {
            // 下午：使用第二次签退的时间限制
            const startTime = getTimeLimit('signOut2', true);
            if (currentTime < startTime) {
                buttonText = '签退(未到时间)';
                isDisabled = true;
            }
        } else {
            // 上午：使用第一次签退的时间限制
            const startTime = getTimeLimit('signOut1', true);
            if (currentTime < startTime) {
                buttonText = '签退(未到时间)';
                isDisabled = true;
            }
        }
        
        signOutButtonHtml = `<button class="sign-btn sign-out-btn ${isDisabled ? 'disabled' : ''}" 
                            ${isDisabled ? '' : `onclick="handleSign('${student.idCard}', 'signOut')"`} 
                            ${isDisabled ? 'disabled' : ''}>${buttonText}</button>`;
    } else {
        signOutButtonHtml = `<button class="sign-btn signed" disabled>签退完成</button>`;
    }
    
    // 组合按钮HTML
    const buttonHtml = `
        <div class="button-group">
            ${signInButtonHtml}
            ${signOutButtonHtml}
        </div>
    `;
    
    // 状态文本（显示具体次数）
    let statusText = '';
    if (isCompleted) {
        statusText = '已完成';
    } else {
        const statusParts = [];
        if (signInCount >= 2) {
            statusParts.push('签到完成');
        } else if (signInCount > 0) {
            statusParts.push(`已签到${signInCount}次`);
        }
        if (signOutCount >= 2) {
            statusParts.push('签退完成');
        } else if (signOutCount > 0) {
            statusParts.push(`已签退${signOutCount}次`);
        }
        statusText = statusParts.length > 0 ? statusParts.join(' ') : '未签到';
    }
    
    card.innerHTML = `
        <div class="student-info">
            <div class="student-name-row">
                <div class="student-name">${student.name}</div>
                <button class="view-details-btn" onclick="showStudentDetails('${student.idCard}')">查看详情</button>
            </div>
        </div>
        ${buttonHtml}
    `;
    
    return card;
}

// 显示学生详情
function showStudentDetails(idCard) {
    const student = studentsData.find(s => s.idCard === idCard);
    const records = signData[getSignDataKey(idCard)] || [];
    
    // 创建详情模态框
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'details-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal-content details-modal';
    
    // 统计信息（支持多次签到签退）
    let totalSignInCount = 0;
    let totalSignOutCount = 0;
    records.forEach(record => {
        const signIns = Array.isArray(record.signIns) ? record.signIns : (record.signIn ? [record.signIn] : []);
        const signOuts = Array.isArray(record.signOuts) ? record.signOuts : (record.signOut ? [record.signOut] : []);
        totalSignInCount += signIns.length;
        totalSignOutCount += signOuts.length;
    });
    
    let recordsHtml = '';
    if (records.length === 0) {
        recordsHtml = '<p class="no-records">暂无签到记录</p>';
    } else {
        recordsHtml = records.map(record => {
            const signIns = Array.isArray(record.signIns) ? record.signIns : (record.signIn ? [record.signIn] : []);
            const signOuts = Array.isArray(record.signOuts) ? record.signOuts : (record.signOut ? [record.signOut] : []);
            
            let recordHtml = `<div class="detail-record">
                <div class="detail-date">${formatDateDisplay(record.date)}</div>`;
            signIns.forEach((time, index) => {
                recordHtml += `<div class="detail-time sign-in-time">签到${index + 1}: ${time}</div>`;
            });
            signOuts.forEach((time, index) => {
                recordHtml += `<div class="detail-time sign-out-time">签退${index + 1}: ${time}</div>`;
            });
            recordHtml += '</div>';
            return recordHtml;
        }).join('');
    }
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2>${student.name} - 签到详情</h2>
            <button class="modal-close" onclick="closeDetailsModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="detail-stats">
                <div class="detail-stat-item">
                    <span class="detail-stat-label">总签到次数：</span>
                    <span class="detail-stat-value">${totalSignInCount}</span>
                </div>
                <div class="detail-stat-item">
                    <span class="detail-stat-label">总签退次数：</span>
                    <span class="detail-stat-value">${totalSignOutCount}</span>
                </div>
            </div>
            <div class="detail-records">
                <h3 class="detail-records-title">签到记录</h3>
                ${recordsHtml}
            </div>
        </div>
        <div class="modal-footer">
            <button class="modal-btn confirm-btn" onclick="closeDetailsModal()">关闭</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 点击背景关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeDetailsModal();
        }
    });
}

// 关闭详情模态框
function closeDetailsModal() {
    const overlay = document.getElementById('details-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// 显示日期设置模态框
function showDateSetupModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'date-setup-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    
    // 显示已设定的日期
    let datesHtml = '';
    if (signDates.length === 0) {
        datesHtml = '<p class="no-dates-text">暂无设定的签到日期</p>';
    } else {
        datesHtml = signDates.map((dateStr, index) => `
            <div class="date-item">
                <span>${formatDateDisplay(dateStr)}</span>
                <button class="remove-date-btn" onclick="removeDate(${index})">删除</button>
            </div>
        `).join('');
    }
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2>设置签到日期</h2>
            <button class="modal-close" onclick="closeDateSetupModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="date-setup-section">
                <label class="time-label">添加签到日期：</label>
                <input type="date" id="new-date-input" class="time-input">
                <button class="add-date-btn" onclick="addDate()">添加日期</button>
            </div>
            <div class="date-list-section">
                <h3 class="date-list-title">已设定的日期：</h3>
                <div class="date-list">
                    ${datesHtml}
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="modal-btn confirm-btn" onclick="closeDateSetupModal()">完成</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 点击背景关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeDateSetupModal();
        }
    });
}

// 关闭日期设置模态框
function closeDateSetupModal({ reRender = true } = {}) {
    const overlay = document.getElementById('date-setup-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
    if (reRender) {
        setupDateSelector();
        if (signDates.length > 0 && !signDates.includes(currentDate)) {
            currentDate = signDates[0];
        }
        renderStudents(getCurrentFilter());
        updateStats();
    }
}

// 添加日期
function addDate() {
    const input = document.getElementById('new-date-input');
    const dateStr = input.value;
    
    if (!dateStr) {
        showNotification('请选择日期', 'warning');
        return;
    }
    
    if (signDates.includes(dateStr)) {
        showNotification('该日期已存在', 'warning');
        return;
    }
    
    signDates.push(dateStr);
    signDates.sort(); // 按日期排序
    localStorage.setItem('signDates', JSON.stringify(signDates));
    
    // 切换到新建日期并刷新界面
    currentDate = dateStr;
    resetFilterToAll();
    closeDateSetupModal({ reRender: false });
    setupDateSelector();
    renderStudents('all');
    updateStats();
    
    showNotification('新签到日期已创建，界面已重置', 'success');
}

// 删除日期
function removeDate(index) {
    signDates.splice(index, 1);
    localStorage.setItem('signDates', JSON.stringify(signDates));
    showDateSetupModal(); // 刷新显示
    showNotification('日期已删除', 'success');
}

// 显示时间限制设置模态框
function showTimeLimitsModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'time-limits-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    
    // 格式化时间显示
    function formatTime(hour, minute) {
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    
    const currentActivity = activities.find(a => a.id === currentActivityId);
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2>⏰ 时间限制 - ${currentActivity?.name || '当前活动'}</h2>
            <button class="modal-close" onclick="closeTimeLimitsModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="activity-time-notice">
                <span class="notice-icon">ℹ️</span>
                <span>此时间限制仅对当前活动"${currentActivity?.name || '当前活动'}"生效，不影响其他活动。</span>
            </div>
            <div class="time-limits-section">
                <h3 class="time-limits-title">签到时间限制</h3>
                <div class="time-limit-item">
                    <label class="time-label">第一次签到截止时间：</label>
                    <input type="time" 
                           id="sign-in-1-end-input" 
                           class="time-input" 
                           value="${formatTime(timeLimits.signIn1.endHour, timeLimits.signIn1.endMinute)}">
                    <span class="time-hint">（必须在此时间之前签到）</span>
                </div>
                <div class="time-limit-item">
                    <label class="time-label">第二次签到截止时间：</label>
                    <input type="time" 
                           id="sign-in-2-end-input" 
                           class="time-input" 
                           value="${formatTime(timeLimits.signIn2.endHour, timeLimits.signIn2.endMinute)}">
                    <span class="time-hint">（必须在此时间之前签到）</span>
                </div>
            </div>
            <div class="time-limits-section">
                <h3 class="time-limits-title">签退时间限制</h3>
                <div class="time-limit-item">
                    <label class="time-label">第一次签退开始时间：</label>
                    <input type="time" 
                           id="sign-out-1-input" 
                           class="time-input" 
                           value="${formatTime(timeLimits.signOut1.startHour, timeLimits.signOut1.startMinute)}">
                    <span class="time-hint">（必须在此时间之后签退）</span>
                </div>
                <div class="time-limit-item">
                    <label class="time-label">第二次签退开始时间：</label>
                    <input type="time" 
                           id="sign-out-2-input" 
                           class="time-input" 
                           value="${formatTime(timeLimits.signOut2.startHour, timeLimits.signOut2.startMinute)}">
                    <span class="time-hint">（必须在此时间之后签退）</span>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="modal-btn cancel-btn" onclick="closeTimeLimitsModal()">取消</button>
            <button class="modal-btn confirm-btn" onclick="saveTimeLimits()">保存</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 点击背景关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeTimeLimitsModal();
        }
    });
}

// 关闭时间限制设置模态框
function closeTimeLimitsModal() {
    const overlay = document.getElementById('time-limits-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// 保存时间限制
function saveTimeLimits() {
    const signIn1EndInput = document.getElementById('sign-in-1-end-input').value;
    const signIn2EndInput = document.getElementById('sign-in-2-end-input').value;
    const signOut1Input = document.getElementById('sign-out-1-input').value;
    const signOut2Input = document.getElementById('sign-out-2-input').value;
    
    // 解析时间
    function parseTime(timeStr) {
        const [hour, minute] = timeStr.split(':').map(Number);
        return { hour, minute };
    }
    
    const newTimeLimits = {
        signIn1: {
            endHour: parseTime(signIn1EndInput).hour,
            endMinute: parseTime(signIn1EndInput).minute
        },
        signIn2: {
            endHour: parseTime(signIn2EndInput).hour,
            endMinute: parseTime(signIn2EndInput).minute
        },
        signOut1: {
            startHour: parseTime(signOut1Input).hour,
            startMinute: parseTime(signOut1Input).minute,
            endHour: 23,
            endMinute: 59
        },
        signOut2: {
            startHour: parseTime(signOut2Input).hour,
            startMinute: parseTime(signOut2Input).minute,
            endHour: 23,
            endMinute: 59
        }
    };
    
    // 保存到当前活动
    const currentActivity = activities.find(a => a.id === currentActivityId);
    if (currentActivity) {
        currentActivity.timeLimits = newTimeLimits;
        localStorage.setItem('activities', JSON.stringify(activities));
        
        // 更新全局 timeLimits 变量
        timeLimits = newTimeLimits;
        
        console.log(`活动"${currentActivity.name}"的时间限制已保存:`, newTimeLimits);
    }
    
    closeTimeLimitsModal();
    
    // 强制刷新界面
    const currentFilter = getCurrentFilter();
    renderStudents(currentFilter);
    updateStats();
    
    const activity = activities.find(a => a.id === currentActivityId);
    showNotification(`活动"${activity?.name || '当前活动'}"的时间限制已保存`, 'success');
}

// 处理签到/签退（显示输入框）
function handleSign(idCard, type) {
    // 确保使用今天的日期
    currentDate = getTodayDate();
    
    // 检查时间限制
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    // 获取学生记录（使用活动ID）
    const key = getSignDataKey(idCard);
    if (!signData[key]) {
        signData[key] = [];
    }
    let record = signData[key].find(r => r.date === currentDate);
    if (!record) {
        record = { date: currentDate, signIns: [], signOuts: [] };
        signData[key].push(record);
    }
    
    // 兼容旧数据格式
    if (!Array.isArray(record.signIns)) {
        record.signIns = record.signIn ? [record.signIn] : [];
        delete record.signIn;
    }
    if (!Array.isArray(record.signOuts)) {
        record.signOuts = record.signOut ? [record.signOut] : [];
        delete record.signOut;
    }
    
    // 判断当前是上午还是下午
    const noonTime = 12 * 60; // 12:00 作为上下午分界点
    const isAfternoon = currentTime >= noonTime;
    
    // 严格检查时间限制（根据上下午时间段）
    if (type === 'signIn') {
        const signInCount = record.signIns.length;
        if (signInCount >= 2) {
            showNotification('已达到最大签到次数（2次）', 'warning');
            return;
        }
        
        // 根据上下午使用不同的时间限制
        if (isAfternoon) {
            // 下午：使用第二次签到限制
            const endTime = getTimeLimit('signIn2', false);
            const limit = timeLimits.signIn2;
            if (currentTime >= endTime) {
                showNotification(`签到必须在${String(limit.endHour).padStart(2, '0')}:${String(limit.endMinute).padStart(2, '0')}之前`, 'warning');
                return;
            }
        } else {
            // 上午：使用第一次签到限制
            const endTime = getTimeLimit('signIn1', false);
            const limit = timeLimits.signIn1;
            if (currentTime >= endTime) {
                showNotification(`签到必须在${String(limit.endHour).padStart(2, '0')}:${String(limit.endMinute).padStart(2, '0')}之前`, 'warning');
                return;
            }
        }
    } else if (type === 'signOut') {
        const signOutCount = record.signOuts.length;
        if (signOutCount >= 2) {
            showNotification('已达到最大签退次数（2次）', 'warning');
            return;
        }
        
        // 根据上下午使用不同的时间限制
        if (isAfternoon) {
            // 下午：使用第二次签退限制
            const startTime = getTimeLimit('signOut2', true);
            const limit = timeLimits.signOut2;
            if (currentTime < startTime) {
                showNotification(`签退必须在${String(limit.startHour).padStart(2, '0')}:${String(limit.startMinute).padStart(2, '0')}之后`, 'warning');
                return;
            }
        } else {
            // 上午：使用第一次签退限制
            const startTime = getTimeLimit('signOut1', true);
            const limit = timeLimits.signOut1;
            if (currentTime < startTime) {
                showNotification(`签退必须在${String(limit.startHour).padStart(2, '0')}:${String(limit.startMinute).padStart(2, '0')}之后`, 'warning');
                return;
            }
        }
    }
    
    // 时间检查通过，显示输入模态框
    showIdCardInputModal(idCard, type);
}

// 显示身份证后四位输入模态框
function showIdCardInputModal(idCard, type) {
    // 创建模态框背景
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'sign-modal-overlay';
    
    // 创建模态框内容
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    
    // 获取学生信息
    const student = studentsData.find(s => s.idCard === idCard);
    const actionText = type === 'signIn' ? '签到' : '签退';
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2>身份验证 - ${actionText}</h2>
            <button class="modal-close" onclick="closeSignModal()">&times;</button>
        </div>
        <div class="modal-body">
            <p class="modal-student-name">学生姓名：<strong>${student.name}</strong></p>
            <p class="modal-prompt">请输入身份证后四位进行验证：</p>
            <input type="text" 
                   id="id-card-input" 
                   class="id-card-input" 
                   placeholder="请输入后四位"
                   maxlength="4"
                   autocomplete="off">
            <p class="error-message" id="error-message"></p>
        </div>
        <div class="modal-footer">
            <button class="modal-btn cancel-btn" onclick="closeSignModal()">取消</button>
            <button class="modal-btn confirm-btn" onclick="verifyAndSign('${idCard}', '${type}')">确认</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 聚焦输入框
    const input = document.getElementById('id-card-input');
    input.focus();
    
    // 限制只能输入数字和X
    input.addEventListener('input', function(e) {
        this.value = this.value.replace(/[^0-9Xx]/g, '').toUpperCase();
    });
    
    // 按回车键确认
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            verifyAndSign(idCard, type);
        }
    });
    
    // 点击背景关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeSignModal();
        }
    });
}

// 关闭模态框
function closeSignModal() {
    const overlay = document.getElementById('sign-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// 验证并完成签到/签退
function verifyAndSign(idCard, type) {
    const input = document.getElementById('id-card-input');
    const errorMsg = document.getElementById('error-message');
    const inputValue = input.value.trim().toUpperCase();
    const lastFourDigits = idCard.slice(-4).toUpperCase();
    
    // 清除之前的错误信息
    errorMsg.textContent = '';
    errorMsg.style.display = 'none';
    
    // 验证输入
    if (!inputValue) {
        errorMsg.textContent = '请输入身份证后四位';
        errorMsg.style.display = 'block';
        input.focus();
        return;
    }
    
    if (inputValue.length !== 4) {
        errorMsg.textContent = '请输入4位数字或字母';
        errorMsg.style.display = 'block';
        input.focus();
        return;
    }
    
    // 验证后四位是否匹配
    if (inputValue !== lastFourDigits) {
        errorMsg.textContent = '身份证后四位不正确，请重新输入';
        errorMsg.style.display = 'block';
        input.value = '';
        input.focus();
        return;
    }
    
    // 验证通过，检查时间限制
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute; // 转换为分钟数便于比较
    
    // 初始化学生数据
    if (!signData[idCard]) {
        signData[idCard] = [];
    }
    
    // 查找或创建当前日期的记录
    let record = signData[idCard].find(r => r.date === currentDate);
    if (!record) {
        record = { date: currentDate, signIns: [], signOuts: [] };
        signData[idCard].push(record);
    }
    
    // 兼容旧数据格式
    if (!Array.isArray(record.signIns)) {
        record.signIns = record.signIn ? [record.signIn] : [];
        delete record.signIn;
    }
    if (!Array.isArray(record.signOuts)) {
        record.signOuts = record.signOut ? [record.signOut] : [];
        delete record.signOut;
    }
    
    // 判断当前是上午还是下午
    const noonTime = 12 * 60; // 12:00 作为上下午分界点
    const isAfternoon = currentTime >= noonTime;
    
    // 验证时间限制（根据上下午时间段）
    if (type === 'signIn') {
        const signInCount = record.signIns.length;
        
        // 检查签到次数
        if (signInCount >= 2) {
            errorMsg.textContent = '已达到最大签到次数（2次）';
            errorMsg.style.display = 'block';
            return;
        }
        
        // 根据上下午使用不同的时间限制
        if (isAfternoon) {
            // 下午：使用第二次签到限制
            const endTime = getTimeLimit('signIn2', false);
            const limit = timeLimits.signIn2;
            if (currentTime >= endTime) {
                errorMsg.textContent = `签到必须在${String(limit.endHour).padStart(2, '0')}:${String(limit.endMinute).padStart(2, '0')}之前`;
                errorMsg.style.display = 'block';
                return;
            }
        } else {
            // 上午：使用第一次签到限制
            const endTime = getTimeLimit('signIn1', false);
            const limit = timeLimits.signIn1;
            if (currentTime >= endTime) {
                errorMsg.textContent = `签到必须在${String(limit.endHour).padStart(2, '0')}:${String(limit.endMinute).padStart(2, '0')}之前`;
                errorMsg.style.display = 'block';
                return;
            }
        }
    } else if (type === 'signOut') {
        const signOutCount = record.signOuts.length;
        
        // 检查签退次数
        if (signOutCount >= 2) {
            errorMsg.textContent = '已达到最大签退次数（2次）';
            errorMsg.style.display = 'block';
            return;
        }
        
        // 根据上下午使用不同的时间限制
        if (isAfternoon) {
            // 下午：使用第二次签退限制
            const startTime = getTimeLimit('signOut2', true);
            const limit = timeLimits.signOut2;
            if (currentTime < startTime) {
                errorMsg.textContent = `签退必须在${String(limit.startHour).padStart(2, '0')}:${String(limit.startMinute).padStart(2, '0')}之后`;
                errorMsg.style.display = 'block';
                return;
            }
        } else {
            // 上午：使用第一次签退限制
            const startTime = getTimeLimit('signOut1', true);
            const limit = timeLimits.signOut1;
            if (currentTime < startTime) {
                errorMsg.textContent = `签退必须在${String(limit.startHour).padStart(2, '0')}:${String(limit.startMinute).padStart(2, '0')}之后`;
                errorMsg.style.display = 'block';
                return;
            }
        }
    }
    
    // 时间验证通过，完成签到/签退
    const timeString = now.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // 记录签到/签退时间
    if (type === 'signIn') {
        record.signIns.push(timeString);
    } else if (type === 'signOut') {
        record.signOuts.push(timeString);
    }
    
    localStorage.setItem('signData', JSON.stringify(signData));
    
    // 关闭模态框
    closeSignModal();
    
    // 强制刷新显示
    console.log('签到/签退成功，刷新界面');
    updateStats();
    const currentFilter = getCurrentFilter();
    renderStudents(currentFilter);
    
    // 显示成功提示
    const actionText = type === 'signIn' ? '签到' : '签退';
    showNotification(`${actionText}成功！时间：${timeString}`);
}

// 更新统计信息
function updateStats() {
    const currentStudents = getCurrentStudents();
    const total = currentStudents.length;
    const dateData = signData;
    
    let signedCount = 0;
    let completedCount = 0;
    
    currentStudents.forEach(student => {
        const records = dateData[getSignDataKey(student.idCard)] || [];
        const todayRecord = records.find(r => r.date === currentDate);
        if (todayRecord) {
            const signIns = Array.isArray(todayRecord.signIns) ? todayRecord.signIns : (todayRecord.signIn ? [todayRecord.signIn] : []);
            const signOuts = Array.isArray(todayRecord.signOuts) ? todayRecord.signOuts : (todayRecord.signOut ? [todayRecord.signOut] : []);
            
            if (signIns.length > 0) {
                signedCount++;
            }
            if (signIns.length >= 2 && signOuts.length >= 2) {
                completedCount++;
            }
        }
    });
    
    const unsignedCount = total - signedCount;
    
    document.getElementById('total-count').textContent = total;
    document.getElementById('signed-count').textContent = signedCount;
    document.getElementById('unsigned-count').textContent = unsignedCount;
    document.getElementById('signed-out-count').textContent = completedCount;
}

// 设置筛选按钮
function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.getAttribute('data-filter');
            renderStudents(filter);
        });
    });
}

// 重置筛选状态为“全部”，用于新增日期后回到默认界面
function resetFilterToAll() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    let hasAllButton = false;
    filterButtons.forEach(btn => {
        const isAll = btn.getAttribute('data-filter') === 'all';
        if (isAll) {
            hasAllButton = true;
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    if (!hasAllButton) {
        renderStudents('all');
    }
}

// 获取当前筛选状态
function getCurrentFilter() {
    const activeBtn = document.querySelector('.filter-btn.active');
    return activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
}

// 处理重置签到
function handleReset() {
    // 检查当前活动是否有签到数据
    let hasData = false;
    studentsData.forEach(student => {
        const records = signData[getSignDataKey(student.idCard)] || [];
        const todayRecord = records.find(r => r.date === currentDate);
        if (todayRecord) {
            hasData = true;
        }
    });
    
    if (!hasData) {
        showNotification('当前日期没有签到数据', 'warning');
        return;
    }
    
    // 显示确认对话框
    showResetConfirmModal();
}

// 显示重置确认模态框
function showResetConfirmModal() {
    // 创建模态框背景
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'reset-modal-overlay';
    
    // 创建模态框内容
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2>确认重置</h2>
            <button class="modal-close" onclick="closeResetModal()">&times;</button>
        </div>
        <div class="modal-body">
            <p class="modal-prompt">确定要重置 <strong>${formatDateDisplay(currentDate)}</strong> 的签到数据吗？</p>
            <p class="reset-warning">此操作将清除该日期的所有签到记录，且无法恢复！</p>
        </div>
        <div class="modal-footer">
            <button class="modal-btn cancel-btn" onclick="closeResetModal()">取消</button>
            <button class="modal-btn reset-confirm-btn" onclick="confirmReset()">确认重置</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 点击背景关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeResetModal();
        }
    });
}

// 关闭重置确认模态框
function closeResetModal() {
    const overlay = document.getElementById('reset-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// 确认重置
function confirmReset() {
    // 清除当前活动和日期的所有签到数据
    studentsData.forEach(student => {
        const key = getSignDataKey(student.idCard);
        if (signData[key]) {
            signData[key] = signData[key].filter(r => r.date !== currentDate);
            if (signData[key].length === 0) {
                delete signData[key];
            }
        }
    });
    
    localStorage.setItem('signData', JSON.stringify(signData));
    
    // 关闭模态框
    closeResetModal();
    
    // 更新显示
    updateStats();
    renderStudents(getCurrentFilter());
    
    // 显示成功提示
    showNotification('签到数据已重置', 'success');
}

// 显示签到历史模态框
function showHistoryModal() {
    // 创建模态框背景
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'history-modal-overlay';
    
    // 创建模态框内容
    const modal = document.createElement('div');
    modal.className = 'modal-content details-modal';
    modal.style.maxWidth = '900px';
    
    // 获取所有日期的签到统计数据
    const historyData = getHistoryData();
    
    let historyHtml = '';
    if (historyData.length === 0) {
        historyHtml = '<div class="no-records">暂无签到历史记录</div>';
    } else {
        // 按日期倒序排列
        historyData.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        historyHtml = historyData.map(dayData => {
            const completionRate = ((dayData.signedCount / dayData.totalCount) * 100).toFixed(1);
            const allCompletedCount = dayData.allCompletedCount;
            
            return `
                <div class="history-day-card">
                    <div class="history-day-header">
                        <div class="history-date">
                            <span class="history-date-text">${formatDateDisplay(dayData.date)}</span>
                            ${dayData.date === getTodayDate() ? '<span class="today-badge">今天</span>' : ''}
                        </div>
                        <div class="history-stats-summary">
                            <span class="completion-rate" style="color: ${completionRate >= 80 ? '#4caf50' : completionRate >= 50 ? '#ff9800' : '#f44336'}">
                                完成率: ${completionRate}%
                            </span>
                        </div>
                    </div>
                    <div class="history-day-stats">
                        <div class="history-stat-item">
                            <div class="history-stat-label">总人数</div>
                            <div class="history-stat-value">${dayData.totalCount}</div>
                        </div>
                        <div class="history-stat-item">
                            <div class="history-stat-label">已签到</div>
                            <div class="history-stat-value" style="color: #2196f3">${dayData.signedCount}</div>
                        </div>
                        <div class="history-stat-item">
                            <div class="history-stat-label">全部完成</div>
                            <div class="history-stat-value" style="color: #4caf50">${allCompletedCount}</div>
                        </div>
                        <div class="history-stat-item">
                            <div class="history-stat-label">总签到次数</div>
                            <div class="history-stat-value" style="color: #9c27b0">${dayData.totalSignIns}</div>
                        </div>
                        <div class="history-stat-item">
                            <div class="history-stat-label">总签退次数</div>
                            <div class="history-stat-value" style="color: #4caf50">${dayData.totalSignOuts}</div>
                        </div>
                    </div>
                    <button class="view-day-details-btn" onclick="showDayDetails('${dayData.date}')">
                        查看详细记录
                    </button>
                </div>
            `;
        }).join('');
    }
    
    const currentActivity = activities.find(a => a.id === currentActivityId);
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2>📊 签到历史记录 - ${currentActivity?.name || '当前活动'}</h2>
            <button class="modal-close" onclick="closeHistoryModal()">&times;</button>
        </div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
            <div class="history-summary">
                <div class="summary-card">
                    <div class="summary-label">历史总天数</div>
                    <div class="summary-value">${historyData.length}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">总签到人次</div>
                    <div class="summary-value">${historyData.reduce((sum, d) => sum + d.totalSignIns, 0)}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">总签退人次</div>
                    <div class="summary-value">${historyData.reduce((sum, d) => sum + d.totalSignOuts, 0)}</div>
                </div>
            </div>
            <div class="history-list">
                ${historyHtml}
            </div>
        </div>
        <div class="modal-footer">
            <button class="modal-btn cancel-btn" onclick="exportHistoryData()">导出数据</button>
            <button class="modal-btn confirm-btn" onclick="closeHistoryModal()">关闭</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // 点击背景关闭
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeHistoryModal();
        }
    });
}

// 获取历史数据统计（仅当前活动）
function getHistoryData() {
    const historyMap = new Map();
    
    // 遍历当前活动的签到数据
    Object.keys(signData).forEach(key => {
        // 只处理当前活动的数据
        if (!key.startsWith(currentActivityId + '-')) {
            return;
        }
        
        const records = signData[key];
        records.forEach(record => {
            if (!historyMap.has(record.date)) {
            historyMap.set(record.date, {
                date: record.date,
                totalCount: getCurrentStudents().length,
                    signedCount: 0,
                    allCompletedCount: 0,
                    totalSignIns: 0,
                    totalSignOuts: 0,
                    students: []
                });
            }
            
            const dayData = historyMap.get(record.date);
            const signInCount = record.signIns?.length || 0;
            const signOutCount = record.signOuts?.length || 0;
            
            if (signInCount > 0 || signOutCount > 0) {
                dayData.signedCount++;
            }
            
            if (signInCount >= 2 && signOutCount >= 2) {
                dayData.allCompletedCount++;
            }
            
            dayData.totalSignIns += signInCount;
            dayData.totalSignOuts += signOutCount;
            
            // 提取身份证号（去掉activity前缀）
            const idCard = key.split('-').slice(1).join('-');
            
            dayData.students.push({
                idCard,
                signInCount,
                signOutCount,
                signIns: record.signIns || [],
                signOuts: record.signOuts || []
            });
        });
    });
    
    return Array.from(historyMap.values());
}

// 显示某天的详细记录
function showDayDetails(date) {
    // 关闭历史模态框
    closeHistoryModal();
    
    // 创建详细记录模态框
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'day-details-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal-content details-modal';
    modal.style.maxWidth = '800px';
    
    // 获取当天所有学生的记录（当前活动）
    const dayRecords = [];
    studentsData.forEach(student => {
        const records = signData[getSignDataKey(student.idCard)] || [];
        const dayRecord = records.find(r => r.date === date);
        
        dayRecords.push({
            student,
            record: dayRecord
        });
    });
    
    // 按签到情况排序：已完成 > 已签到 > 未签到
    dayRecords.sort((a, b) => {
        const aSignIns = a.record?.signIns?.length || 0;
        const aSignOuts = a.record?.signOuts?.length || 0;
        const bSignIns = b.record?.signIns?.length || 0;
        const bSignOuts = b.record?.signOuts?.length || 0;
        
        const aCompleted = (aSignIns >= 2 && aSignOuts >= 2) ? 1 : 0;
        const bCompleted = (bSignIns >= 2 && bSignOuts >= 2) ? 1 : 0;
        
        if (aCompleted !== bCompleted) return bCompleted - aCompleted;
        
        const aTotal = aSignIns + aSignOuts;
        const bTotal = bSignIns + bSignOuts;
        return bTotal - aTotal;
    });
    
    let detailsHtml = dayRecords.map(({ student, record }) => {
        const signIns = record?.signIns || [];
        const signOuts = record?.signOuts || [];
        const isCompleted = signIns.length >= 2 && signOuts.length >= 2;
        const hasSigned = signIns.length > 0 || signOuts.length > 0;
        
        let statusClass = 'unsigned';
        let statusText = '未签到';
        if (isCompleted) {
            statusClass = 'completed';
            statusText = '已完成';
        } else if (hasSigned) {
            statusClass = 'signed';
            statusText = '进行中';
        }
        
        let timesHtml = '';
        if (signIns.length > 0) {
            timesHtml += signIns.map((time, index) => 
                `<div class="detail-time sign-in-time">📝 签到${index + 1}: ${time}</div>`
            ).join('');
        }
        if (signOuts.length > 0) {
            timesHtml += signOuts.map((time, index) => 
                `<div class="detail-time sign-out-time">✅ 签退${index + 1}: ${time}</div>`
            ).join('');
        }
        if (!hasSigned) {
            timesHtml = '<div class="detail-time" style="color: #999;">暂无记录</div>';
        }
        
        return `
            <div class="day-detail-record">
                <div class="day-detail-header">
                    <span class="day-detail-name">${student.name}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="day-detail-times">
                    ${timesHtml}
                </div>
            </div>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2>📅 ${formatDateDisplay(date)} 详细记录</h2>
            <button class="modal-close" onclick="closeDayDetailsModal()">&times;</button>
        </div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
            <div class="day-details-list">
                ${detailsHtml}
            </div>
        </div>
        <div class="modal-footer">
            <button class="modal-btn cancel-btn" onclick="closeDayDetailsModal(); showHistoryModal();">返回历史</button>
            <button class="modal-btn confirm-btn" onclick="closeDayDetailsModal()">关闭</button>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeDayDetailsModal();
        }
    });
}

// 关闭历史模态框
function closeHistoryModal() {
    const overlay = document.getElementById('history-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// 关闭日详情模态框
function closeDayDetailsModal() {
    const overlay = document.getElementById('day-details-modal-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// 导出历史数据为CSV
function exportHistoryData() {
    const historyData = getHistoryData();
    
    if (historyData.length === 0) {
        showNotification('暂无数据可导出', 'warning');
        return;
    }
    
    // 创建CSV内容
    let csv = '日期,总人数,已签到人数,全部完成人数,总签到次数,总签退次数,完成率\n';
    
    historyData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    historyData.forEach(dayData => {
        const completionRate = ((dayData.signedCount / dayData.totalCount) * 100).toFixed(1);
        csv += `${dayData.date},${dayData.totalCount},${dayData.signedCount},${dayData.allCompletedCount},${dayData.totalSignIns},${dayData.totalSignOuts},${completionRate}%\n`;
    });
    
    // 添加详细记录
    csv += '\n\n详细记录\n';
    csv += '日期,姓名,身份证号,签到次数,签退次数,签到时间,签退时间\n';
    
    historyData.forEach(dayData => {
        dayData.students.forEach(studentData => {
            const student = studentsData.find(s => s.idCard === studentData.idCard);
            if (student) {
                const signInTimes = studentData.signIns.join(' | ');
                const signOutTimes = studentData.signOuts.join(' | ');
                csv += `${dayData.date},${student.name},${student.idCard},${studentData.signInCount},${studentData.signOutCount},"${signInTimes}","${signOutTimes}"\n`;
            }
        });
    });
    
    // 创建下载链接
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `签到历史_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('数据导出成功', 'success');
}

// 显示通知
function showNotification(message, type = 'success') {
    // 创建通知元素
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : '#f44336';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', init);
