document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('invite.html')) {
        initInvitePage();
        addInviteEventListeners();
    } else if (currentPath.includes('task.html')) {
        initTaskPage();
    } else if (currentPath.includes('my.html')) {
        initMyPage();
        addMyEventListeners();
    } else if (currentPath.includes('admin.html')) {
        initAdminPage();
        addAdminEventListeners();
    } else if (currentPath.includes('withdraw-records.html')) {
        initWithdrawRecordsPage();
    } else if (currentPath.includes('faq.html')) {
        initFAQPage();
    } else {
        initIndexPage();
    }
    
    initPullToRefresh();
    setActiveNavItem();
});

// 全局邀请记录缓存 - 存储最新的邀请记录
const inviteCache = {
    records: [], // 邀请记录数组
    isInitialized: false, // 是否已初始化
    
    // 初始化缓存
    async initialize(count = 10) {
        try {
            // 从数据库加载记录
            const records = await inviteDB.getInvites(count);
            
            // 所有已有记录清除新标记
            records.forEach(record => {
                record.isNew = false;
            });
            
            this.records = records;
            this.isInitialized = true;
            console.log('邀请记录缓存已初始化:', this.records.length, '条记录');
            return this.records;
        } catch (error) {
            console.error('初始化邀请记录缓存失败:', error);
            return [];
        }
    },
    
    // 添加新记录 - 新记录始终添加到最前面
    addRecords(newRecords) {
        if (!Array.isArray(newRecords)) {
            newRecords = [newRecords]; // 转换为数组
        }
        
        if (newRecords.length === 0) {
            return this.records;
        }
        
        // 清除所有现有记录的"新"标记
        this.records.forEach(record => {
            record.isNew = false;
        });
        
        // 添加"新"标记到所有新记录
        newRecords.forEach(record => {
            record.isNew = true;
        });
        
        // 按时间戳降序排序新记录（最新的在最前面）
        newRecords.sort((a, b) => b.timestamp - a.timestamp);
        
        // 合并记录 - 新记录在前，旧记录在后
        this.records = [...newRecords, ...this.records];
        
        console.log('缓存已更新:', this.records.length, '条记录，新增', newRecords.length, '条');
        return this.records;
    },
    
    // 获取指定数量的记录
    getRecords(count = 10) {
        return this.records.slice(0, count);
    },
    
    // 清除所有"新"标记（用于下次刷新前）
    clearNewFlags() {
        this.records.forEach(record => {
            record.isNew = false;
        });
    }
};

// 首页相关函数
async function initIndexPage() {
    try {
        const configs = await inviteDB.getAllConfig();
        updateStatistics(configs);
    } catch (error) {
        console.error('初始化首页数据失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

function updateStatistics(configs) {
    const todayCount = document.getElementById('today-count');
    const totalCount = document.getElementById('total-count');
    const todayEarnings = document.getElementById('today-earnings');
    const totalEarnings = document.getElementById('total-earnings');
    
    if (todayCount) {
        todayCount.textContent = configs.todayCount;
    }
    
    if (totalCount) {
        totalCount.textContent = configs.totalCount;
    }
    
    if (todayEarnings) {
        const earnings = (configs.todayCount * configs.invitePrice).toFixed(2);
        todayEarnings.textContent = `¥${earnings}`;
    }
    
    if (totalEarnings) {
        const earnings = (configs.totalCount * configs.invitePrice).toFixed(2);
        totalEarnings.textContent = `¥${earnings}`;
    }
}

// 邀请页面相关函数
async function initInvitePage() {
    try {
        // 获取配置数据
        const configs = await inviteDB.getAllConfig();
        
        // 设置邀请码
        const inviteCodeElement = document.getElementById('invite-code');
        if (inviteCodeElement) {
            inviteCodeElement.textContent = configs.inviteCode;
        }
        
        // 更新统计数据
        updateInviteStatistics(configs);
        
        // 初始化邀请记录缓存并渲染列表
        const displayCount = configs.inviteDisplayCount || 10;
        await inviteCache.initialize(displayCount);
        renderInviteList(inviteCache.getRecords(displayCount));
        
    } catch (error) {
        console.error('初始化邀请页面失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

function addInviteEventListeners() {
    const copyCodeBtn = document.getElementById('copy-code-btn');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', async function() {
            const inviteCode = document.getElementById('invite-code').textContent;
            try {
                await copyToClipboard(inviteCode);
                showToast('邀请码已复制到剪贴板');
            } catch (error) {
                console.error('复制邀请码失败:', error);
                showToast('复制失败，请手动复制');
            }
        });
    }
}

function updateInviteStatistics(configs) {
    const todayCount = document.getElementById('today-count');
    const totalCount = document.getElementById('total-count');
    const todayEarnings = document.getElementById('today-earnings');
    const totalEarnings = document.getElementById('total-earnings');
    const inviteTotalCount = document.getElementById('invite-total-count');
    
    if (todayCount) {
        todayCount.textContent = configs.todayCount;
    }
    
    if (totalCount) {
        totalCount.textContent = configs.totalCount;
    }
    
    if (inviteTotalCount) {
        inviteTotalCount.textContent = configs.totalCount;
    }
    
    if (todayEarnings) {
        const earnings = (configs.todayCount * configs.invitePrice).toFixed(2);
        todayEarnings.textContent = `¥${earnings}`;
    }
    
    if (totalEarnings) {
        const earnings = (configs.totalCount * configs.invitePrice).toFixed(2);
        totalEarnings.textContent = `¥${earnings}`;
    }
}

// 将updateInviteList函数添加到全局作用域
window.updateInviteList = updateInviteList;

async function updateInviteList() {
    try {
        console.log('开始更新邀请列表...');
        
        // 获取显示数量
        const displayCount = await inviteDB.getConfig('inviteDisplayCount') || 10;
        console.log('需要显示的邀请记录数量:', displayCount);
        
        // 重新初始化缓存，确保获取最新数据
        await inviteCache.initialize(displayCount);
        
        // 渲染邀请列表
        renderInviteList(inviteCache.getRecords(displayCount));
        
        console.log('邀请列表更新完成，显示', inviteCache.getRecords(displayCount).length, '条记录');
    } catch (error) {
        console.error('更新邀请列表失败:', error);
    }
}

// 将renderInviteList函数添加到全局作用域
window.renderInviteList = renderInviteList;

function renderInviteList(invites) {
    const container = document.getElementById('invite-list-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!invites || invites.length === 0) {
        container.innerHTML = '<div class="text-center py-5 text-gray-500">暂无邀请记录</div>';
        return;
    }
    
    invites.forEach((invite, index) => {
        const inviteEl = document.createElement('div');
        
        // 设置样式类
        const baseClass = 'invite-record fade-in';
        inviteEl.className = invite.isNew 
            ? `${baseClass} new-invite-highlight` 
            : baseClass;
        
        // 获取昵称的第一个字符，处理emoji的情况
        let firstChar = invite.name.charAt(0);
        if (/[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(invite.name.substring(0, 2))) {
            firstChar = invite.name.substring(0, 2);
        }
        
        // 渲染邀请记录
        inviteEl.innerHTML = `
            <div class="avatar" style="background-color: ${invite.avatarColor || '#3498db'}">
                ${firstChar}
            </div>
            <div class="invite-info">
                <div class="invite-name">${invite.name}</div>
                <div class="invite-time">${formatDateTime(invite.timestamp)}</div>
            </div>
            <div class="invite-amount">+¥${invite.amount.toFixed(2)}</div>
            ${invite.isNew ? '<div class="new-badge">新</div>' : ''}
        `;
        
        container.appendChild(inviteEl);
    });
}

// 任务页面相关函数
async function initTaskPage() {
    try {
        const configs = await inviteDB.getAllConfig();
        updateTaskStatistics(configs);
    } catch (error) {
        console.error('初始化任务页面失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

function updateTaskStatistics(configs) {
    const todayEarnings = document.getElementById('today-earnings');
    
    if (todayEarnings) {
        const earnings = (configs.todayCount * configs.invitePrice).toFixed(2);
        todayEarnings.textContent = `¥${earnings}`;
    }
}

// 个人中心页面相关函数
async function initMyPage() {
    try {
        const configs = await inviteDB.getAllConfig();
        const userInfo = await inviteDB.getAllUserInfo();
        
        // 初始化邀请码
        const inviteCodeElement = document.getElementById('invite-code');
        if (inviteCodeElement) {
            inviteCodeElement.textContent = configs.inviteCode;
        }
        
        // 初始化用户头像和名称
        updateUserInfo(userInfo);
        
        // 更新统计数据
        updateMyStatistics(configs);
        
        // 初始化弹窗内容
        initModals(configs);
        
    } catch (error) {
        console.error('初始化个人中心页面失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

// 更新用户信息显示
function updateUserInfo(userInfo) {
    const avatarEl = document.getElementById('user-avatar');
    const usernameEl = document.getElementById('username');
    const memberTypeEl = document.getElementById('member-type');
    
    if (userInfo.avatarUrl && avatarEl) {
        // 如果有头像URL，显示图片
        avatarEl.innerHTML = `<img src="${userInfo.avatarUrl}" alt="头像" class="w-full h-full rounded-full object-cover">`;
    } else if (avatarEl && userInfo.username) {
        // 没有头像但有用户名，显示首字母
        avatarEl.innerText = userInfo.username.charAt(0);
    }
    
    if (usernameEl && userInfo.username) {
        usernameEl.textContent = userInfo.username;
    }
    
    if (memberTypeEl && userInfo.memberType) {
        memberTypeEl.textContent = userInfo.memberType;
    }
}

// 初始化弹窗内容
function initModals(configs) {
    const modalTotalEarnings = document.getElementById('modal-total-earnings');
    if (modalTotalEarnings) {
        const earnings = (configs.todayCount * configs.invitePrice).toFixed(2);
        modalTotalEarnings.textContent = earnings + '元';
    }
}

function addMyEventListeners() {
    // 复制邀请码
    const copyCodeBtn = document.getElementById('copy-code-btn');
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', async function() {
            const inviteCode = document.getElementById('invite-code').textContent;
            try {
                await copyToClipboard(inviteCode);
                showToast('邀请码已复制到剪贴板');
            } catch (error) {
                console.error('复制邀请码失败:', error);
                showToast('复制失败，请手动复制');
            }
        });
    }
    
    // 弹窗相关
    const modalOverlay = document.getElementById('modal-overlay');
    const withdrawModal = document.getElementById('withdraw-modal');
    const settingsModal = document.getElementById('settings-modal');
    
    // 打开提现弹窗
    const withdrawBtn = document.getElementById('withdraw-btn');
    if (withdrawBtn && modalOverlay && withdrawModal) {
        withdrawBtn.addEventListener('click', function() {
            modalOverlay.classList.remove('hidden');
            withdrawModal.classList.remove('hidden');
        });
    }
    
    // 打开设置弹窗
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn && modalOverlay && settingsModal) {
        settingsBtn.addEventListener('click', function() {
            loadUserSettings();
            modalOverlay.classList.remove('hidden');
            settingsModal.classList.remove('hidden');
        });
    }
    
    // 关闭弹窗
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // 点击弹窗外部关闭
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            if (e.target === modalOverlay) {
                closeAllModals();
            }
        });
    }
    
    // 确认提现
    const submitWithdrawBtn = document.getElementById('submit-withdraw');
    if (submitWithdrawBtn) {
        submitWithdrawBtn.addEventListener('click', submitWithdrawal);
    }
    
    // 保存设置
    const saveSettingsBtn = document.getElementById('save-settings');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveUserSettings);
    }
}

// 关闭所有弹窗
function closeAllModals() {
    const modalOverlay = document.getElementById('modal-overlay');
    const withdrawModal = document.getElementById('withdraw-modal');
    const settingsModal = document.getElementById('settings-modal');
    
    if (modalOverlay) modalOverlay.classList.add('hidden');
    if (withdrawModal) withdrawModal.classList.add('hidden');
    if (settingsModal) settingsModal.classList.add('hidden');
}

// 加载用户设置到弹窗
async function loadUserSettings() {
    try {
        const avatarUrl = await inviteDB.getUserInfo('avatarUrl');
        const username = await inviteDB.getUserInfo('username');
        
        const avatarUrlInput = document.getElementById('avatar-url');
        const userNicknameInput = document.getElementById('user-nickname');
        
        if (avatarUrlInput && avatarUrl) {
            avatarUrlInput.value = avatarUrl;
        }
        
        if (userNicknameInput && username) {
            userNicknameInput.value = username;
        }
    } catch (error) {
        console.error('加载用户设置失败:', error);
    }
}

// 保存用户设置
async function saveUserSettings() {
    try {
        const avatarUrlInput = document.getElementById('avatar-url');
        const userNicknameInput = document.getElementById('user-nickname');
        
        if (avatarUrlInput) {
            await inviteDB.setUserInfo('avatarUrl', avatarUrlInput.value);
        }
        
        if (userNicknameInput) {
            await inviteDB.setUserInfo('username', userNicknameInput.value);
        }
        
        // 重新加载用户信息
        const userInfo = await inviteDB.getAllUserInfo();
        updateUserInfo(userInfo);
        
        closeAllModals();
        showToast('设置保存成功');
    } catch (error) {
        console.error('保存用户设置失败:', error);
        showToast('保存设置失败，请重试');
    }
}

// 提交提现申请
async function submitWithdrawal() {
    try {
        const amountInput = document.getElementById('withdraw-amount');
        const nameInput = document.getElementById('withdraw-name');
        const accountInput = document.getElementById('withdraw-account');
        
        if (!amountInput || !nameInput || !accountInput) {
            showToast('表单不完整，请重试');
            return;
        }
        
        const amount = parseFloat(amountInput.value);
        const name = nameInput.value.trim();
        const account = accountInput.value.trim();
        
        // 验证输入
        if (isNaN(amount) || amount <= 0) {
            showToast('请输入有效的提现金额');
            return;
        }
        
        if (!name) {
            showToast('请输入收款人姓名');
            return;
        }
        
        if (!account) {
            showToast('请输入收款账号');
            return;
        }
        
        // 获取当前可提现余额
        const configs = await inviteDB.getAllConfig();
        const availableAmount = parseFloat((configs.todayCount * configs.invitePrice).toFixed(2));
        
        if (amount > availableAmount) {
            showToast('提现金额不能超过可提现余额');
            return;
        }
        
        // 先将之前的所有提现记录状态更新为"已打款"
        try {
            const updatedCount = await inviteDB.updatePreviousWithdrawals();
            console.log(`已将 ${updatedCount} 条提现记录状态更新为"已打款"`);
        } catch (error) {
            console.error('更新之前的提现记录状态失败:', error);
            // 继续执行，不影响新记录的添加
        }
        
        // 添加提现记录
        await inviteDB.addWithdrawal({
            amount: amount,
            name: name,
            account: account,
            timestamp: Date.now(),
            status: '处理中'
        });
        
        // 扣除已提现金额（通过减少今日新增人数）
        const newTodayCount = Math.max(0, Math.floor(configs.todayCount - amount / configs.invitePrice));
        await inviteDB.setConfig('todayCount', newTodayCount);
        
        // 重置表单
        amountInput.value = '';
        nameInput.value = '';
        accountInput.value = '';
        
        // 关闭模态框
        closeAllModals();
        
        // 显示成功提示
        showToast('提现申请已提交，请在提现记录页面查看状态');
        
        // 更新页面数据
        await updatePageData();
    } catch (error) {
        console.error('提交提现申请失败:', error);
        showToast('提交失败，请重试');
    }
}

// 提现记录页面初始化
async function initWithdrawRecordsPage() {
    try {
        const withdrawals = await inviteDB.getWithdrawals(50); // 获取最多50条记录
        renderWithdrawals(withdrawals);
    } catch (error) {
        console.error('初始化提现记录页面失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

// 将renderWithdrawals函数添加到全局作用域
window.renderWithdrawals = renderWithdrawals;

// 渲染提现记录列表
function renderWithdrawals(withdrawals) {
    const container = document.getElementById('withdraw-list-container');
    const emptyMessage = document.getElementById('empty-message');
    
    if (!container) return;
    
    // 如果没有记录，显示空消息
    if (!withdrawals || withdrawals.length === 0) {
        if (emptyMessage) {
            emptyMessage.style.display = 'block';
        }
        return;
    }
    
    // 隐藏空消息
    if (emptyMessage) {
        emptyMessage.style.display = 'none';
    }
    
    // 清空容器
    container.innerHTML = '';
    
    // 添加标题行
    const titleRow = document.createElement('div');
    titleRow.className = 'grid grid-cols-3 font-bold pb-2 mb-3 border-b border-gray-200';
    titleRow.innerHTML = `
        <div>金额</div>
        <div>时间</div>
        <div class="text-right">状态</div>
    `;
    container.appendChild(titleRow);
    
    // 对记录进行排序：首先按状态排序（处理中的排在前面），然后按时间倒序排序
    const sortedWithdrawals = [...withdrawals].sort((a, b) => {
        // 先按状态排序
        if (a.status === '处理中' && b.status !== '处理中') return -1;
        if (a.status !== '处理中' && b.status === '处理中') return 1;
        
        // 再按时间倒序
        return b.timestamp - a.timestamp;
    });
    
    // 渲染每条记录
    sortedWithdrawals.forEach(withdrawal => {
        const recordEl = document.createElement('div');
        recordEl.className = 'grid grid-cols-3 py-3 border-b border-gray-100';
        
        // 根据状态设置颜色和背景
        let statusClass = 'text-yellow-500';
        let rowClass = '';
        
        if (withdrawal.status === '已打款') {
            statusClass = 'text-green-500';
            rowClass = 'bg-green-50';
        } else if (withdrawal.status === '已拒绝') {
            statusClass = 'text-red-500';
            rowClass = 'bg-red-50';
        } else if (withdrawal.status === '处理中') {
            statusClass = 'text-yellow-500 font-bold';
            rowClass = 'bg-yellow-50';
        }
        
        if (rowClass) {
            recordEl.className += ` ${rowClass}`;
        }
        
        recordEl.innerHTML = `
            <div class="font-medium">¥${withdrawal.amount.toFixed(2)}</div>
            <div class="text-sm text-gray-500">${formatDateTime(withdrawal.timestamp)}</div>
            <div class="text-right ${statusClass}">${withdrawal.status}</div>
        `;
        
        container.appendChild(recordEl);
    });
}

// 常见问题页面初始化
async function initFAQPage() {
    try {
        const faqs = await inviteDB.getFAQs();
        renderFAQs(faqs);
    } catch (error) {
        console.error('初始化常见问题页面失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

// 渲染常见问题列表
function renderFAQs(faqs) {
    const container = document.getElementById('faq-container');
    const emptyMessage = document.getElementById('empty-message');
    
    if (!container) return;
    
    // 如果没有FAQ，显示消息
    if (!faqs || faqs.length === 0) {
        if (emptyMessage) {
            emptyMessage.textContent = '暂无常见问题';
        }
        return;
    }
    
    // 隐藏空消息
    if (emptyMessage) {
        emptyMessage.style.display = 'none';
    }
    
    // 清空容器
    container.innerHTML = '';
    
    // 渲染每个FAQ项
    faqs.forEach((faq, index) => {
        const faqEl = document.createElement('div');
        faqEl.className = 'mb-4 border-b border-gray-100 pb-4';
        if (index === faqs.length - 1) {
            faqEl.className = 'mb-4';
        }
        
        faqEl.innerHTML = `
            <h3 class="font-bold text-lg mb-2">${faq.question}</h3>
            <p class="text-gray-600">${faq.answer}</p>
        `;
        
        container.appendChild(faqEl);
    });
}

// 更新个人中心统计数据
function updateMyStatistics(configs) {
    const totalCount = document.getElementById('total-count');
    const todayEarnings = document.getElementById('today-earnings');
    const totalEarnings = document.getElementById('total-earnings');
    
    if (totalCount) {
        totalCount.textContent = `${configs.totalCount}人`;
    }
    
    if (todayEarnings) {
        const earnings = (configs.todayCount * configs.invitePrice).toFixed(2);
        todayEarnings.textContent = `+¥${earnings}`;
    }
    
    if (totalEarnings) {
        const earnings = (configs.todayCount * configs.invitePrice).toFixed(2);
        totalEarnings.textContent = earnings;
    }
}

// 管理页面相关函数
async function initAdminPage() {
    try {
        const configs = await inviteDB.getAllConfig();
        fillFormData(configs);
        renderRules(configs.refreshRules);
    } catch (error) {
        console.error('初始化管理后台页面失败:', error);
        showToast('加载数据失败，请刷新重试');
    }
}

function fillFormData(configs) {
    document.getElementById('invite-price').value = configs.invitePrice;
    document.getElementById('today-count').value = configs.todayCount;
    document.getElementById('total-count').value = configs.totalCount;
    document.getElementById('invite-code').value = configs.inviteCode;
    document.getElementById('invite-display-count').value = configs.inviteDisplayCount;
}

function renderRules(rules) {
    const container = document.getElementById('rules-container');
    container.innerHTML = '';
    
    if (!rules || rules.length === 0) {
        return;
    }
    
    const template = document.getElementById('rule-template');
    
    rules.forEach(rule => {
        const ruleElement = document.importNode(template.content, true);
        
        ruleElement.querySelector('.rule-increment').value = rule.increment;
        ruleElement.querySelector('.rule-probability').value = rule.probability;
        
        ruleElement.querySelector('.delete-rule').addEventListener('click', function() {
            this.closest('.rule-item').remove();
        });
        
        container.appendChild(ruleElement);
    });
}

function addAdminEventListeners() {
    document.getElementById('add-rule-btn').addEventListener('click', function() {
        const template = document.getElementById('rule-template');
        const ruleElement = document.importNode(template.content, true);
        
        // 确保添加的规则输入框使用正确的属性
        ruleElement.querySelector('.rule-increment').value = "0";
        ruleElement.querySelector('.rule-increment').min = "0";
        ruleElement.querySelector('.rule-probability').value = "0";
        ruleElement.querySelector('.rule-probability').min = "0";
        ruleElement.querySelector('.rule-probability').max = "100";
        ruleElement.querySelector('.rule-probability').step = "0.1";
        
        ruleElement.querySelector('.delete-rule').addEventListener('click', function() {
            this.closest('.rule-item').remove();
        });
        
        document.getElementById('rules-container').appendChild(ruleElement);
    });
    
    document.getElementById('save-settings-btn').addEventListener('click', async function() {
        await saveSettings();
    });
    
    document.getElementById('reset-all-btn').addEventListener('click', function() {
        if (confirm('确定要重置所有数据吗？此操作不可恢复！')) {
            resetAllData();
        }
    });
}

async function saveSettings() {
    try {
        const invitePrice = parseFloat(document.getElementById('invite-price').value);
        const todayCount = parseInt(document.getElementById('today-count').value);
        const totalCount = parseInt(document.getElementById('total-count').value);
        const inviteCode = document.getElementById('invite-code').value;
        const inviteDisplayCount = parseInt(document.getElementById('invite-display-count').value);
        
        if (isNaN(invitePrice) || invitePrice < 0) {
            showToast('邀请单价不能为负数');
            return;
        }
        
        if (isNaN(todayCount) || todayCount < 0) {
            showToast('今日新增用户不能为负数');
            return;
        }
        
        if (isNaN(totalCount) || totalCount < 0) {
            showToast('总邀请人数不能为负数');
            return;
        }
        
        if (!inviteCode.trim()) {
            showToast('邀请码不能为空');
            return;
        }
        
        if (isNaN(inviteDisplayCount) || inviteDisplayCount < 1) {
            showToast('邀请界面显示条数必须大于0');
            return;
        }
        
        const rules = [];
        const ruleItems = document.querySelectorAll('.rule-item');
        let totalProbability = 0;
        
        ruleItems.forEach(item => {
            const increment = parseInt(item.querySelector('.rule-increment').value);
            const probability = parseFloat(item.querySelector('.rule-probability').value);
            
            if (!isNaN(increment) && !isNaN(probability) && increment >= 0 && probability >= 0) {
                rules.push({ increment, probability });
                totalProbability += probability;
                console.log(`添加规则: 增长人数=${increment}, 概率=${probability}%`);
            } else {
                console.warn(`忽略无效规则: 增长人数=${increment}, 概率=${probability}%`);
            }
        });
        
        if (rules.length === 0) {
            showToast('至少需要添加一条规则');
            return;
        }
        
        // 添加日志以便于调试
        console.log('规则总概率:', totalProbability);
        
        // 放宽对总概率的要求，允许有0.5%的误差
        if (Math.abs(totalProbability - 100) > 0.5) {
            showToast(`所有规则的概率之和必须接近100%，当前总和为${totalProbability}%`);
            return;
        }
        
        await inviteDB.setConfig('invitePrice', invitePrice);
        await inviteDB.setConfig('todayCount', todayCount);
        await inviteDB.setConfig('totalCount', totalCount);
        await inviteDB.setConfig('inviteCode', inviteCode);
        await inviteDB.setConfig('inviteDisplayCount', inviteDisplayCount);
        await inviteDB.setConfig('refreshRules', rules);
        
        console.log('保存的规则:', rules);
        
        // 显示更详细的成功信息
        showToast(`设置保存成功！共保存了${rules.length}条规则，总概率: ${totalProbability.toFixed(1)}%`);
    } catch (error) {
        console.error('保存设置失败:', error);
        showToast('保存设置失败，请重试');
    }
}

async function resetAllData() {
    try {
        const DBDeleteRequest = indexedDB.deleteDatabase('inviteShareDB');
        
        DBDeleteRequest.onsuccess = function() {
            window.location.reload();
        };
        
        DBDeleteRequest.onerror = function() {
            showToast('重置数据失败，请重试');
        };
    } catch (error) {
        console.error('重置数据失败:', error);
        showToast('重置数据失败，请重试');
    }
} 
