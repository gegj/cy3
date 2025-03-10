/**
 * IndexedDB 数据库操作工具
 */
class InviteDB {
    constructor() {
        this.dbName = 'inviteShareDB';
        this.dbVersion = 1;
        this.db = null;
        this.initPromise = this.init();
        InviteDB.isRefreshing = false;
    }

    /**
     * 初始化数据库
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('数据库打开失败:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('数据库连接成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                console.log('数据库升级');

                // 创建配置表
                if (!db.objectStoreNames.contains('config')) {
                    const configStore = db.createObjectStore('config', { keyPath: 'key' });
                    
                    // 初始化默认配置
                    const defaultConfigs = [
                        { key: 'invitePrice', value: 1.2 },                     // 邀请单价
                        { key: 'todayCount', value: 3 },                      // 今日新增
                        { key: 'totalCount', value: 8653 },                   // 总邀请人数
                        { key: 'inviteCode', value: '6985' },                 // 邀请码
                        { key: 'inviteDisplayCount', value: 6 },              // 邀请界面显示条数
                        { key: 'refreshRules', value: [
                            { increment: 0, probability: 50 },
                            { increment: 1, probability: 30 },
                            { increment: 2, probability: 15 },
                            { increment: 3, probability: 5 }
                        ]}                                                   // 下拉刷新规则
                    ];
                    
                    defaultConfigs.forEach(config => {
                        configStore.add(config);
                    });
                }

                // 创建邀请记录表
                if (!db.objectStoreNames.contains('invites')) {
                    const inviteStore = db.createObjectStore('invites', { keyPath: 'id', autoIncrement: true });
                    inviteStore.createIndex('timestamp', 'timestamp', { unique: false });

                    // 生成一些初始的邀请记录
                    const avatarColors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#d35400', '#34495e'];
                    const now = Date.now();
                    const oneDay = 24 * 60 * 60 * 1000;
                    
                    // 微信风格的昵称列表
                    const wechatNicknames = [
                        '小可爱😊', '阳光男孩', '微笑🌸', '快乐每一天', '幸福如意', 
                        'Amy123', 'Bob', 'Cathy🍀', 'David888', 'Emma', 
                        '😎酷酷的我', '🌟星星点灯', '✨闪闪惹人爱', '🌈彩虹糖果', '🌸樱花雨',
                        '李明', '王小花', '张大山', '刘晓华', '陈志远'
                    ];
                    
                    const initialInvites = [];
                    
                    for (let i = 0; i < 20; i++) {
                        const colorIndex = Math.floor(Math.random() * avatarColors.length);
                        const nicknameIndex = Math.floor(Math.random() * wechatNicknames.length);
                        
                        initialInvites.push({
                            name: wechatNicknames[nicknameIndex],
                            phone: `1${Math.floor(Math.random() * 9 + 1)}${Math.random().toString().slice(2, 10)}`,
                            timestamp: now - Math.floor(Math.random() * 10) * oneDay,
                            avatarColor: avatarColors[colorIndex],
                            amount: 1.2
                        });
                    }
                    
                    for (const invite of initialInvites) {
                        inviteStore.add(invite);
                    }
                }
                
                // 创建提现记录表
                if (!db.objectStoreNames.contains('withdrawals')) {
                    const withdrawalStore = db.createObjectStore('withdrawals', { keyPath: 'id', autoIncrement: true });
                    withdrawalStore.createIndex('timestamp', 'timestamp', { unique: false });
                    
                    // 不预设提现记录，用户提现后才会产生记录
                    console.log('创建提现记录表成功');
                }
                
                // 创建用户信息表，用于存储用户头像和名称等信息
                if (!db.objectStoreNames.contains('userInfo')) {
                    const userInfoStore = db.createObjectStore('userInfo', { keyPath: 'key' });
                    
                    // 设置默认用户信息
                    const defaultUserInfo = [
                        { key: 'avatarUrl', value: '' }, // 默认为空，用户可自定义
                        { key: 'username', value: '用户' + Math.floor(Math.random() * 9000 + 1000) }, // 随机用户名
                        { key: 'memberType', value: '普通会员' } // 会员类型
                    ];
                    
                    defaultUserInfo.forEach(info => {
                        userInfoStore.add(info);
                    });
                    console.log('创建用户信息表成功');
                }
                
                // 创建常见问题表
                if (!db.objectStoreNames.contains('faq')) {
                    const faqStore = db.createObjectStore('faq', { keyPath: 'id', autoIncrement: true });
                    
                    // 设置默认常见问题
                    const defaultFaqs = [
                        { 
                            question: '如何邀请好友?', 
                            answer: '您可以在邀请页面获取您的专属邀请码，将邀请码分享给好友。好友成功注册后，您将获得相应奖励。' 
                        },
                        { 
                            question: '提现有什么要求?', 
                            answer: '可提现金额达到100元后可申请提现，提现申请会在1-3个工作日内审核处理。' 
                        },
                        { 
                            question: '邀请奖励如何计算?', 
                            answer: '每成功邀请一位新用户，您将获得相应的邀请奖励。具体奖励金额 = 新增用户数 × 单价。' 
                        },
                        { 
                            question: '如何修改个人信息?', 
                            answer: '在"我的"页面点击"设置"，可以修改您的头像和用户名等个人信息。' 
                        }
                    ];
                    
                    defaultFaqs.forEach(faq => {
                        faqStore.add(faq);
                    });
                    console.log('创建常见问题表成功');
                }
            };
        });
    }

    /**
     * 获取配置值
     * @param {string} key - 配置键
     * @returns {Promise<any>} - 配置值
     */
    async getConfig(key) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            console.log(`正在获取配置 ${key}`);
            const transaction = this.db.transaction(['config'], 'readonly');
            
            // 添加事务完成和错误处理
            transaction.oncomplete = () => {
                console.log(`获取配置 ${key} 事务完成`);
            };
            
            transaction.onerror = (event) => {
                console.error(`获取配置 ${key} 事务失败:`, event.target.error);
                reject(event.target.error);
            };
            
            const store = transaction.objectStore('config');
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result ? request.result.value : null;
                console.log(`获取配置 ${key} = ${result}`);
                resolve(result);
            };

            request.onerror = (event) => {
                console.error(`获取配置 ${key} 失败:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 设置配置值
     * @param {string} key - 配置键
     * @param {any} value - 配置值
     * @returns {Promise<void>}
     */
    async setConfig(key, value) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            console.log(`正在设置配置 ${key} = ${value}`);
            const transaction = this.db.transaction(['config'], 'readwrite');
            
            // 添加事务完成和错误处理
            transaction.oncomplete = () => {
                console.log(`设置配置 ${key} = ${value} 事务完成`);
            };
            
            transaction.onerror = (event) => {
                console.error(`设置配置 ${key} 事务失败:`, event.target.error);
                reject(event.target.error);
            };
            
            const store = transaction.objectStore('config');
            const request = store.put({ key, value });

            request.onsuccess = () => {
                console.log(`成功设置配置 ${key} = ${value}`);
                resolve();
            };

            request.onerror = (event) => {
                console.error(`设置配置 ${key} = ${value} 失败:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 获取所有配置
     * @returns {Promise<Object>} - 所有配置的对象
     */
    async getAllConfig() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['config'], 'readonly');
            const store = transaction.objectStore('config');
            const request = store.getAll();

            request.onsuccess = () => {
                const configs = {};
                request.result.forEach(item => {
                    configs[item.key] = item.value;
                });
                resolve(configs);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 获取邀请记录
     * @param {number} limit - 限制数量
     * @returns {Promise<Array>} - 邀请记录数组
     */
    async getInvites(limit = 10) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            // 使用新的事务和新的请求，确保获取最新数据
            const transaction = this.db.transaction(['invites'], 'readonly');
            const store = transaction.objectStore('invites');
            const index = store.index('timestamp');
            
            // 添加事务完成事件处理
            transaction.oncomplete = () => {
                console.log('获取邀请记录事务完成，共获取到', invites.length, '条记录');
            };
            
            const request = index.openCursor(null, 'prev');

            const invites = [];
            let count = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && count < limit) {
                    invites.push(cursor.value);
                    count++;
                    cursor.continue();
                } else {
                    resolve(invites);
                }
            };

            request.onerror = (event) => {
                console.error('获取邀请记录失败:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 添加邀请记录
     * @param {Object} invite - 邀请记录
     * @returns {Promise<Object>} - 返回添加的记录，包括ID
     */
    async addInvite(invite) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['invites'], 'readwrite');
            
            // 添加事务完成事件处理
            transaction.oncomplete = () => {
                console.log('添加邀请记录事务完成');
            };
            
            transaction.onerror = (event) => {
                console.error('添加邀请记录事务失败:', event.target.error);
                reject(event.target.error);
            };
            
            const store = transaction.objectStore('invites');
            const inviteObj = {
                ...invite,
                timestamp: invite.timestamp || Date.now()
            };
            
            const request = store.add(inviteObj);

            request.onsuccess = (event) => {
                // 返回完整的记录，包括生成的ID
                resolve({
                    id: event.target.result,
                    ...inviteObj
                });
            };

            request.onerror = (event) => {
                console.error('添加邀请记录请求失败:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 执行下拉刷新增加用户
     * @returns {Promise<Object>} - 返回包含增加数量和新增用户记录的对象
     */
    async refreshAddUsers() {
        // 防止并发调用
        if (InviteDB.isRefreshing) {
            console.log('已经有一个刷新操作在进行中，忽略此次调用');
            return { increment: 0, newInvites: [] };
        }
        
        InviteDB.isRefreshing = true;
        
        try {
            // 获取下拉刷新规则和邀请单价
            const rules = await this.getConfig('refreshRules');
            const invitePrice = await this.getConfig('invitePrice');
            
            // 根据概率随机选择一个增长规则
            let random = Math.random() * 100;
            let cumulativeProbability = 0;
            let selectedRule = rules[0];
            
            for (const rule of rules) {
                cumulativeProbability += rule.probability;
                if (random <= cumulativeProbability) {
                    selectedRule = rule;
                    break;
                }
            }
            
            const increment = selectedRule.increment;
            const newInvites = []; // 存储新增的邀请记录
            
            if (increment > 0) {
                // 更新今日新增和总人数
                const currentTodayCount = await this.getConfig('todayCount');
                const currentTotalCount = await this.getConfig('totalCount');
                
                await this.setConfig('todayCount', currentTodayCount + increment);
                await this.setConfig('totalCount', currentTotalCount + increment);
                
                // 添加新邀请记录
                const avatarColors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#d35400', '#34495e'];
                
                // 创建并添加新用户记录
                for (let i = 0; i < increment; i++) {
                    const colorIndex = Math.floor(Math.random() * avatarColors.length);
                    // 使用微信风格的昵称
                    const name = this.generateWeChatNickname();
                    
                    // 创建新用户记录 - 确保时间戳是最新的
                    const newInvite = {
                        name: name,
                        phone: `1${Math.floor(Math.random() * 9 + 1)}${Math.random().toString().slice(2, 10)}`,
                        timestamp: Date.now() - Math.floor(Math.random() * 60 * 1000), // 最近1分钟内
                        avatarColor: avatarColors[colorIndex],
                        amount: invitePrice
                    };
                    
                    try {
                        // 添加到数据库并获取完整记录（包含ID）
                        const addedInvite = await this.addInvite(newInvite);
                        newInvites.push(addedInvite);
                        console.log('已添加新邀请记录:', addedInvite.name);
                    } catch (error) {
                        console.error('添加邀请记录失败:', error);
                    }
                }
            }
            
            // 返回结果
            return {
                increment: increment,
                newInvites: newInvites
            };
        } catch (error) {
            console.error('刷新增加用户失败:', error);
            throw error;
        } finally {
            // 无论成功还是失败，都重置刷新状态
            InviteDB.isRefreshing = false;
        }
    }
    
    /**
     * 生成随机中文名字
     * @param {number} length - 名字长度
     * @returns {string} - 随机中文名字
     */
    generateRandomChineseName(length) {
        const nameChars = '明东林华国建立志远山水木火土金天正平学诚如荣宝永祥伟涛强军磊晓';
        let result = '';
        for (let i = 0; i < length; i++) {
            const index = Math.floor(Math.random() * nameChars.length);
            result += nameChars[index];
        }
        return result;
    }
    
    /**
     * 生成微信风格的昵称
     * @returns {string} - 微信风格的昵称
     */
    generateWeChatNickname() {
        const nicknameTypes = [
            // 中文网名
            () => {
                const netNames = [
                    '小可爱', '阳光', '微笑', '快乐', '幸福', '温柔', '可爱多', '甜心', '暖暖',
                    '星星', '月亮', '天空', '海洋', '云朵', '雨滴', '雪花', '花朵', '草莓', '柠檬',
                    '奶茶', '咖啡', '巧克力', '冰淇淋', '蛋糕', '糖果', '棒棒糖', '果冻', '布丁',
                    '小仙女', '小王子', '小公主', '小天使', '小魔王', '小恶魔', '小精灵', '小妖精',
                    '大宝贝', '小宝贝', '小可爱', '小甜心', '小宝宝', '小朋友', '小可爱', '小甜甜',
                    '阿狸', '皮卡丘', '哆啦A梦', '小熊维尼', '米老鼠', '唐老鸭', '加菲猫', '史努比'
                ];
                return netNames[Math.floor(Math.random() * netNames.length)];
            },
            
            // 英文名+数字
            () => {
                const engNames = [
                    'Amy', 'Bob', 'Cathy', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack',
                    'Kelly', 'Leo', 'Mia', 'Nick', 'Olivia', 'Peter', 'Queen', 'Ryan', 'Sophia', 'Tom',
                    'Uma', 'Victor', 'Wendy', 'Xander', 'Yolanda', 'Zack', 'Alice', 'Ben', 'Cindy', 'Daniel',
                    'Ella', 'Felix', 'Gina', 'Harry', 'Irene', 'Jason', 'Kate', 'Liam', 'Megan', 'Nathan'
                ];
                const name = engNames[Math.floor(Math.random() * engNames.length)];
                // 50%概率添加数字
                if (Math.random() > 0.5) {
                    return name + Math.floor(Math.random() * 1000);
                }
                return name;
            },
            
            // 带emoji的昵称
            () => {
                const emojis = ['😊', '😄', '😍', '🥰', '😎', '🤩', '🌟', '✨', '🌈', '🌸', '🌺', '🌼', '🌻', '🍀', '🍓', '🍒', '🍎', '🍉', '🍭', '🍬', '🧸', '🎀', '🎵', '🎮', '📱', '💻', '📷', '🏀', '⚽', '🏆'];
                const baseNames = ['小可爱', '阳光', '微笑', '快乐', '幸福', '温柔', 'Amy', 'Bob', 'Cathy', 'David', 'Emma', 'Frank', 'Grace'];
                const name = baseNames[Math.floor(Math.random() * baseNames.length)];
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                // 随机emoji位置
                return Math.random() > 0.5 ? `${emoji}${name}` : `${name}${emoji}`;
            },
            
            // 传统中文姓名
            () => {
                const surnames = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '褚', '卫', '蒋', '沈', '韩', '杨', '朱', '秦', '尤', '许', '何', '吕', '施', '张', '孔', '曹', '严', '华', '金', '魏', '陶', '姜'];
                const nameChars = '明东林华国建立志远山水木火土金天正平学诚如荣宝永祥伟涛强军磊晓';
                const surname = surnames[Math.floor(Math.random() * surnames.length)];
                let name = '';
                for (let i = 0; i < (Math.random() > 0.7 ? 2 : 1); i++) {
                    name += nameChars[Math.floor(Math.random() * nameChars.length)];
                }
                return surname + name;
            }
        ];
        
        // 随机选择一种昵称类型
        const nicknameGenerator = nicknameTypes[Math.floor(Math.random() * nicknameTypes.length)];
        return nicknameGenerator();
    }

    /**
     * 添加提现记录
     * @param {Object} withdrawal - 提现记录
     * @returns {Promise<number>} - 新记录的ID
     */
    async addWithdrawal(withdrawal) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['withdrawals'], 'readwrite');
            const store = transaction.objectStore('withdrawals');
            const request = store.add({
                ...withdrawal,
                timestamp: withdrawal.timestamp || Date.now(),
                status: withdrawal.status || '处理中' // 默认状态：处理中
            });

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 获取提现记录
     * @param {number} limit - 限制数量
     * @returns {Promise<Array>} - 提现记录数组
     */
    async getWithdrawals(limit = 10) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['withdrawals'], 'readonly');
            const store = transaction.objectStore('withdrawals');
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');

            const withdrawals = [];
            let count = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && count < limit) {
                    withdrawals.push(cursor.value);
                    count++;
                    cursor.continue();
                } else {
                    resolve(withdrawals);
                }
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 将之前的所有提现记录状态更新为"已打款"
     * @returns {Promise<number>} - 更新的记录数量
     */
    async updatePreviousWithdrawals() {
        console.log("开始更新之前的提现记录状态...");
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['withdrawals'], 'readwrite');
            const store = transaction.objectStore('withdrawals');
            const request = store.openCursor();
            
            let count = 0;

            transaction.oncomplete = () => {
                console.log(`更新完成，共更新了 ${count} 条提现记录`);
                resolve(count);
            };

            transaction.onerror = (event) => {
                console.error("更新提现记录状态时出错:", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const record = cursor.value;
                    // 只更新状态为"处理中"的记录
                    if (record.status === '处理中') {
                        record.status = '已打款';
                        const updateRequest = cursor.update(record);
                        updateRequest.onsuccess = () => {
                            count++;
                        };
                    }
                    cursor.continue();
                }
            };

            request.onerror = (event) => {
                console.error("遍历提现记录时出错:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 获取用户信息
     * @param {string} key - 信息键名
     * @returns {Promise<any>} - 用户信息值
     */
    async getUserInfo(key) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['userInfo'], 'readonly');
            const store = transaction.objectStore('userInfo');
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.value : null);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 获取所有用户信息
     * @returns {Promise<Object>} - 用户信息对象
     */
    async getAllUserInfo() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['userInfo'], 'readonly');
            const store = transaction.objectStore('userInfo');
            const request = store.getAll();

            request.onsuccess = () => {
                const result = {};
                if (request.result) {
                    request.result.forEach(item => {
                        result[item.key] = item.value;
                    });
                }
                resolve(result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 设置用户信息
     * @param {string} key - 信息键名
     * @param {any} value - 信息值
     * @returns {Promise<void>}
     */
    async setUserInfo(key, value) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['userInfo'], 'readwrite');
            const store = transaction.objectStore('userInfo');
            const request = store.put({ key, value });

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    /**
     * 获取常见问题列表
     * @returns {Promise<Array>} - 常见问题数组
     */
    async getFAQs() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['faq'], 'readonly');
            const store = transaction.objectStore('faq');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }
}

// 创建全局数据库实例
const inviteDB = new InviteDB(); 
