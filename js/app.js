/**
 * 通用工具函数和全局功能
 */

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 初始化下拉刷新
    initPullToRefresh();
    
    // 动态设置活跃导航项
    setActiveNavItem();
});

/**
 * 初始化下拉刷新功能
 */
function initPullToRefresh() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    
    let startY = 0;
    let currentY = 0;
    let pulling = false;
    let refreshing = false;
    let hasMoved = false; // 添加标志，判断是否有移动
    
    // 触摸开始
    mainContent.addEventListener('touchstart', function(e) {
        // 只有在顶部才可以下拉刷新
        if (mainContent.scrollTop > 0) return;
        
        startY = e.touches[0].clientY;
        currentY = startY; // 初始化currentY为startY
        pulling = true;
        hasMoved = false; // 重置移动标志
    });
    
    // 触摸移动
    mainContent.addEventListener('touchmove', function(e) {
        if (!pulling || refreshing) return;
        
        currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;
        
        // 确保是明显的下拉动作（至少移动了10px）
        if (deltaY > 10) {
            hasMoved = true;
            e.preventDefault();
            mainContent.classList.add('refresh-active');
            
            // 设置下拉高度，有阻尼效果，限制最大高度防止覆盖底部导航
            const pullHeight = Math.min(deltaY * 0.4, 60);
            // 只移动刷新指示器，不移动整个内容区域
            const refreshContainer = mainContent.querySelector('.refresh-container');
            if (refreshContainer) {
                refreshContainer.style.marginTop = `${pullHeight}px`;
            }
        }
    });
    
    // 触摸结束
    mainContent.addEventListener('touchend', function() {
        if (!pulling) return;
        pulling = false;
        
        const refreshContainer = mainContent.querySelector('.refresh-container');
        
        // 确保有足够的下拉距离且确实有下拉动作
        if (currentY - startY > 50 && hasMoved && !refreshing) {
            refreshing = true;
            
            // 执行刷新操作
            performRefresh().then(() => {
                // 刷新完成后恢复状态
                setTimeout(() => {
                    if (refreshContainer) {
                        refreshContainer.style.marginTop = '';
                    }
                    mainContent.classList.remove('refresh-active');
                    refreshing = false;
                }, 1000);
            });
        } else {
            // 如果下拉不足或没有下拉动作，恢复状态
            if (refreshContainer) {
                refreshContainer.style.marginTop = '';
            }
            mainContent.classList.remove('refresh-active');
        }
        
        // 重置移动标志
        hasMoved = false;
    });
}

/**
 * 执行刷新操作
 * @returns {Promise<void>}
 */
async function performRefresh() {
    try {
        // 执行数据库刷新操作，增加新用户
        const result = await inviteDB.refreshAddUsers();
        const { increment, newInvites } = result;
        
        // 更新页面数据（统计数据等）
        await updatePageData(true); // 跳过邀请列表更新
        
        // 如果在邀请页面，更新邀请记录列表
        if (window.location.pathname.includes('invite.html')) {
            if (newInvites && newInvites.length > 0) {
                console.log('下拉刷新添加了新用户，更新邀请记录列表');
                
                // 获取显示数量
                const displayCount = await inviteDB.getConfig('inviteDisplayCount') || 10;
                
                // 将新用户添加到缓存并渲染
                inviteCache.addRecords(newInvites);
                const updatedRecords = inviteCache.getRecords(displayCount);
                
                // 渲染更新后的邀请列表
                renderInviteList(updatedRecords);
            }
        }
        
        // 显示刷新结果
        if (increment > 0) {
            showToast(`刷新成功，新增 ${increment} 位用户`);
        } else {
            showToast('刷新成功');
        }
    } catch (error) {
        console.error('刷新失败:', error);
        showToast('刷新失败，请重试');
    }
}

/**
 * 更新页面数据
 * @param {boolean} skipInviteList - 是否跳过更新邀请列表
 */
async function updatePageData(skipInviteList = false) {
    // 获取配置数据
    const configs = await inviteDB.getAllConfig();
    
    // 更新统计数据
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
        todayEarnings.textContent = '¥' + (configs.todayCount * configs.invitePrice).toFixed(2);
    }
    
    if (totalEarnings) {
        totalEarnings.textContent = '¥' + (configs.todayCount * configs.invitePrice).toFixed(2);
    }
    
    // 如果在邀请页面且未设置跳过，更新邀请列表
    if (window.location.pathname.includes('invite.html') && !skipInviteList) {
        // 使用window对象调用main.js中定义的updateInviteList函数
        if (typeof window.updateInviteList === 'function') {
            await window.updateInviteList();
        }
    }
}

/**
 * 设置当前活跃的导航项
 */
function setActiveNavItem() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        link.classList.remove('text-primary');
        link.classList.add('text-gray-500');
        
        if (currentPath.endsWith(linkPath) || 
            (currentPath.endsWith('/') && linkPath === 'index.html')) {
            link.classList.remove('text-gray-500');
            link.classList.add('text-primary');
        }
    });
}

/**
 * 显示Toast提示
 * @param {string} message - 提示信息
 * @param {number} duration - 显示时长，默认3秒
 */
function showToast(message, duration = 3000) {
    // 移除现有的toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 创建新的toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 自动移除
    setTimeout(() => {
        toast.remove();
    }, duration);
}

/**
 * 格式化日期时间
 * @param {number} timestamp - 时间戳
 * @returns {string} - 格式化的日期时间
 */
function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / (60 * 1000));
    const diffHour = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDay = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    
    if (diffMin < 1) {
        return '刚刚';
    } else if (diffMin < 60) {
        return `${diffMin}分钟前`;
    } else if (diffHour < 24) {
        return `${diffHour}小时前`;
    } else if (diffDay < 30) {
        return `${diffDay}天前`;
    } else {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} - 是否复制成功
 */
function copyToClipboard(text) {
    return new Promise((resolve) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => resolve(true))
                .catch(() => {
                    fallbackCopyToClipboard(text);
                    resolve(true);
                });
        } else {
            fallbackCopyToClipboard(text);
            resolve(true);
        }
    });
}

/**
 * 后备的复制到剪贴板方法
 * @param {string} text - 要复制的文本
 */
function fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('复制失败', err);
    }
    
    document.body.removeChild(textarea);
} 
