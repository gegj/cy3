/**
 * 通用工具函数和全局功能
 */

// 全局刷新锁，防止刷新操作重复触发
let globalRefreshLock = false;

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
    
    // 确保事件监听器只被添加一次
    if (mainContent.getAttribute('data-pull-initialized') === 'true') {
        return;
    }
    
    let startY = 0;
    let currentY = 0;
    let pulling = false;
    let refreshing = false;
    let hasMoved = false; // 添加标志，判断是否有移动
    
    // 触摸开始
    mainContent.addEventListener('touchstart', function(e) {
        // 如果全局刷新锁已激活或页面已经在刷新中，不响应触摸事件
        if (globalRefreshLock || refreshing) return;
        
        // 只有在顶部才可以下拉刷新
        if (mainContent.scrollTop > 0) return;
        
        startY = e.touches[0].clientY;
        currentY = startY; // 初始化currentY为startY
        pulling = true;
        hasMoved = false; // 重置移动标志
    });
    
    // 触摸移动
    mainContent.addEventListener('touchmove', function(e) {
        if (!pulling || refreshing || globalRefreshLock) return;
        
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
        if (currentY - startY > 50 && hasMoved && !refreshing && !globalRefreshLock) {
            refreshing = true;
            globalRefreshLock = true; // 激活全局刷新锁
            console.log('开始刷新操作，加锁防止重复触发');
            
            // 执行刷新操作
            performRefresh().then(() => {
                // 刷新完成后恢复状态
                setTimeout(() => {
                    if (refreshContainer) {
                        refreshContainer.style.marginTop = '';
                    }
                    mainContent.classList.remove('refresh-active');
                    refreshing = false;
                    // 延迟释放全局刷新锁，防止快速连续触发
                    setTimeout(() => {
                        globalRefreshLock = false;
                        console.log('刷新操作完成，解锁');
                    }, 500);
                }, 1000);
            }).catch(error => {
                console.error('刷新操作失败:', error);
                // 发生错误时也要解锁
                if (refreshContainer) {
                    refreshContainer.style.marginTop = '';
                }
                mainContent.classList.remove('refresh-active');
                refreshing = false;
                globalRefreshLock = false;
                console.log('刷新操作出错，解锁');
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
    
    // 标记已初始化
    mainContent.setAttribute('data-pull-initialized', 'true');
}

/**
 * 执行刷新操作
 * @returns {Promise<void>}
 */
async function performRefresh() {
    // 确保全局刷新锁开启，防止重复刷新
    if (globalRefreshLock) {
        console.warn('全局刷新锁已开启，忽略当前刷新请求');
        return false;
    }

    const loadingIndicator = document.querySelector('.pull-to-refresh-loading');
    if (loadingIndicator) {
        loadingIndicator.textContent = '刷新中...';
    }

    try {
        // 刷新新增用户
        const refreshResult = await inviteDB.refreshAddUsers();
        const { increment, newInvites } = refreshResult;
        
        // 如果增加了新用户，显示成功消息
        if (increment > 0) {
            // 更新页面数据，但跳过列表更新
            updatePageData(true);
            
            // 如果在邀请页，且有新邀请，更新邀请记录列表
            if (window.location.pathname.includes('invite.html') && newInvites.length > 0) {
                console.log(`已添加${newInvites.length}位新用户`);
                
                // 获取邀请显示数量
                let displayCount = await inviteDB.getConfig('inviteDisplayCount');
                displayCount = displayCount || 10;
                
                // 将新用户添加到缓存中并渲染
                if (typeof inviteCache === 'object' && typeof inviteCache.addRecords === 'function') {
                    // 使用inviteCache对象的方法添加记录
                    inviteCache.addRecords(newInvites);
                    renderInviteList(inviteCache.getRecords(displayCount));
                } else if (Array.isArray(inviteCache)) {
                    // 旧版本：如果inviteCache是数组
                    // 标记新用户为isNew，用于UI显示
                    newInvites.forEach(invite => invite.isNew = true);
                    inviteCache.unshift(...newInvites);
                    renderInviteList(inviteCache.slice(0, displayCount));
                } else {
                    console.error('无法更新邀请缓存，类型不支持:', typeof inviteCache);
                    // 如果缓存不存在或无效，直接使用新记录渲染
                    newInvites.forEach(invite => invite.isNew = true);
                    renderInviteList(newInvites);
                }
                
                // 显示添加成功的提示
                showToast(`刷新成功，增加了${increment}位新用户`);
            } else {
                showToast(`刷新成功，增加了${increment}位新用户`);
            }
            
            return true;
        } else {
            // 如果没有增加新用户，显示相应消息
            showToast('刷新完成，暂时没有新用户');
            return false;
        }
    } catch (error) {
        console.error('刷新失败:', error);
        showToast('刷新失败，请稍后再试');
        return false;
    } finally {
        // 无论成功失败，都重置刷新状态
        refreshing = false;
        document.querySelector('.pull-to-refresh').classList.remove('refreshing');
        if (loadingIndicator) {
            loadingIndicator.textContent = '下拉刷新';
        }
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
 * 显示一个简单的Toast提示
 * @param {string} message - 要显示的消息
 * @param {number} duration - 显示持续时间，单位毫秒
 */
function showToast(message, duration = 2000) {
    // 检查是否已存在Toast元素
    let toast = document.querySelector('.toast-message');
    
    if (!toast) {
        // 创建新的Toast元素
        toast = document.createElement('div');
        toast.className = 'toast-message';
        document.body.appendChild(toast);
        
        // 添加基本样式
        toast.style.position = 'fixed';
        toast.style.bottom = '20%';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        toast.style.color = 'white';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '4px';
        toast.style.zIndex = '10000';
        toast.style.maxWidth = '80%';
        toast.style.textAlign = 'center';
        toast.style.transition = 'opacity 0.3s';
    }
    
    // 设置消息并显示
    toast.textContent = message;
    toast.style.opacity = '1';
    
    // 设置定时器，自动隐藏
    setTimeout(() => {
        toast.style.opacity = '0';
        // 完全隐藏后从DOM中移除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
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
