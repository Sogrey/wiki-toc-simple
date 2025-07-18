/**
 * Wiki.js 多级目录生成器 - 简化版
 * 
 * 功能描述：
 * - 解决Wiki.js原生目录只能显示两级的问题
 * - 自动扫描页面内容中的所有标题（h1-h6）
 * - 生成带锚点链接的多级目录树
 * - 支持平滑滚动到对应标题位置
 * - 适配深色主题，提供美观的视觉效果
 * 
 * 主要特性：
 * - 自动检测标题层级并生成缩进
 * - 优先使用Wiki.js已有的锚点ID
 * - 响应式设计，支持移动端
 * - 自定义滚动条样式
 * - 提供API接口供外部调用
 * 
 * 作者：Sogrey
 * 版本：1.0.2
 * 兼容性：现代浏览器（Chrome、Firefox、Safari、Edge）
 */

(function() {
    'use strict';
    
    /**
     * 全局配置对象
     * 包含脚本运行所需的所有配置参数
     */
    const config = {
        // 文章内容选择器 - 用于查找包含标题的内容区域
        // 支持多个备选选择器，提高兼容性
        contentSelector: '.contents, [class*="contents"], main .contents',
        
        // 原始目录容器选择器 - 用于定位Wiki.js的原生目录
        // 脚本会隐藏原生目录并插入自定义目录
        tocSelector: '.v-list--nav, [class*="v-list--nav"], .page-col-sd .v-list',
        
        // 目录标题文本
        tocTitle: '目录',
        
        // 滚动偏移量 - 点击目录链接时，目标位置距离顶部的距离
        // 避免标题被固定导航栏遮挡
        scrollOffset: 80
    };
    
    /**
     * 移除已存在的自定义目录
     * 
     * 功能：
     * - 查找并移除之前生成的 .wiki-toc-simple 目录
     * - 恢复Wiki.js原生目录的显示状态
     * - 在重新生成目录前调用，确保干净的状态
     */
    function removeExistingTOC() {
        // 查找已存在的自定义目录
        const existingTOC = document.querySelector('.wiki-toc-simple');
        if (existingTOC) {
            existingTOC.remove();
            console.log('已移除旧目录');
        }
        
        // 恢复原始Wiki.js目录的显示
        const originalTOC = document.querySelector(config.tocSelector);
        if (originalTOC) {
            originalTOC.style.display = '';
        }
    }
    
    /**
     * 生成多级目录
     * 
     * 主要流程：
     * 1. 清理已存在的目录
     * 2. 查找文章内容区域
     * 3. 扫描所有标题元素
     * 4. 生成目录HTML结构
     * 5. 插入到页面并绑定事件
     */
    function generateTOC() {
        // 清理之前生成的目录，确保干净状态
        removeExistingTOC();
        
        // 查找文章内容区域
        const content = document.querySelector(config.contentSelector);
        if (!content) {
            console.warn('未找到文章内容，请检查 contentSelector 配置');
            return;
        }
        
        // 查找所有标题元素（h1-h6），排除 .tabset 内部的标题
        const allHeadings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const headings = Array.from(allHeadings).filter(heading => {
            // 检查标题是否在 .tabset 元素内部
            const isInTabset = heading.closest('.tabset');
            return !isInTabset; // 返回不在 .tabset 内的标题
        });
        
        if (headings.length === 0) {
            console.log('未找到标题元素，无法生成目录');
            return;
        }
        
        // 构建目录HTML结构
        let tocHTML = `
            <div class="wiki-toc-simple">
                <div class="wiki-toc-title">${config.tocTitle}</div>
                <ul class="wiki-toc-list">
        `;
        
        // 遍历所有标题，生成目录项
        headings.forEach((heading, index) => {
            // 获取标题层级（h1=1, h2=2, ...）
            const level = parseInt(heading.tagName.charAt(1));
            // 获取标题文本内容
            const text = heading.textContent.trim();
            
            // 锚点ID处理策略：优先使用已有的ID
            let id = '';
            
            // 策略1：检查标题元素本身是否已有ID属性
            if (heading.id) {
                id = heading.id;
            }
            // 策略2：检查标题内部是否已有锚点链接
            else {
                const anchorLink = heading.querySelector('a[href^="#"]');
                if (anchorLink) {
                    id = anchorLink.getAttribute('href').substring(1);
                }
            }
            
            // 策略3：如果都没有找到，则生成新的ID
            if (!id) {
                id = generateId(text, index);
                // 为标题元素添加ID属性
                if (!heading.id) {
                    heading.id = id;
                }
            }
            
            // 计算缩进距离：根据层级计算，基础缩进为5px
            const indent = (level - 1) * 12 + 5;
            
            // 生成目录项HTML
            tocHTML += `
                <li class="wiki-toc-item" data-level="${level}">
                    <a href="#${id}" class="wiki-toc-link" style="padding-left: ${indent}px;">
                        ${text}
                    </a>
                </li>
            `;
        });
        
        // 完成HTML结构
        tocHTML += '</ul></div>';
        
        // 将生成的目录插入到页面中
        insertTOC(tocHTML);
        
        // 为目录链接绑定点击事件
        bindEvents();
        
        console.log(`目录生成完成，共 ${headings.length} 个标题`);
    }
    
    /**
     * 生成锚点ID
     * 
     * @param {string} text - 标题文本
     * @param {number} index - 标题索引
     * @returns {string} 生成的ID
     * 
     * 处理规则：
     * 1. 转换为小写
     * 2. 移除特殊字符，保留字母、数字、中文
     * 3. 将空格和特殊字符替换为连字符
     * 4. 移除首尾连字符
     * 5. 如果结果为空，使用索引作为备用ID
     */
    function generateId(text, index) {
        let id = text
            .toLowerCase()
            .replace(/[^\w\u4e00-\u9fa5]/g, '-')  // 保留字母、数字、中文，其他替换为连字符
            .replace(/-+/g, '-')                  // 多个连字符合并为一个
            .replace(/^-|-$/g, '');               // 移除首尾连字符
        
        // 如果生成的ID为空，使用索引作为备用
        if (!id) {
            id = `heading-${index}`;
        }
        
        return id;
    }
    
    /**
     * 绑定滚动监听事件，实现目录高亮
     * 
     * 功能：
     * - 监听页面滚动事件
     * - 计算当前可见的标题
     * - 高亮对应的目录项
     * - 使用节流优化性能
     */
    function bindScrollEvents() {
        let ticking = false;
        let headings = [];
        let tocLinks = [];
        
        // 获取所有标题和对应的目录链接
        function updateElements() {
            const content = document.querySelector(config.contentSelector);
            if (content) {
                // 查找所有标题，排除 .tabset 内部的标题
                const allHeadings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
                headings = Array.from(allHeadings).filter(heading => {
                    // 检查标题是否在 .tabset 元素内部
                    const isInTabset = heading.closest('.tabset');
                    return !isInTabset; // 返回不在 .tabset 内的标题
                });
                tocLinks = Array.from(document.querySelectorAll('.wiki-toc-link'));
            }
        }
        
        // 初始化元素列表
        updateElements();
        
        // 移除所有高亮
        function clearHighlights() {
            tocLinks.forEach(link => {
                link.classList.remove('wiki-toc-active');
            });
        }
        
        // 高亮指定目录项
        function highlightTocItem(targetId) {
            clearHighlights();
            const activeLink = document.querySelector(`.wiki-toc-link[href="#${targetId}"]`);
            if (activeLink) {
                activeLink.classList.add('wiki-toc-active');
                
                // 检查目录项是否在可视区域内，如果不在则自动滚动
                scrollTocToVisible(activeLink);
            }
        }
        
        // 计算当前可见的标题
        function getCurrentHeading() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const offset = config.scrollOffset + 10; // 添加一些容差
            
            // 从后往前查找，找到第一个在视口上方的标题
            for (let i = headings.length - 1; i >= 0; i--) {
                const heading = headings[i];
                const headingTop = heading.offsetTop;
                
                if (headingTop <= scrollTop + offset) {
                    return heading.id;
                }
            }
            
            // 如果没有找到，返回第一个标题
            return headings.length > 0 ? headings[0].id : null;
        }
        
        // 滚动处理函数
        function handleScroll() {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const currentId = getCurrentHeading();
                    if (currentId) {
                        highlightTocItem(currentId);
                    }
                    ticking = false;
                });
                ticking = true;
            }
        }
        
        // 绑定滚动事件
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // 初始高亮
        setTimeout(() => {
            const currentId = getCurrentHeading();
            if (currentId) {
                highlightTocItem(currentId);
            }
        }, 100);
        
        /**
         * 将目录项滚动到可视区域
         * 
         * @param {HTMLElement} activeLink - 当前活跃的目录链接元素
         */
        function scrollTocToVisible(activeLink) {
            const tocContainer = document.querySelector('.wiki-toc-simple');
            if (!tocContainer) return;
            
            // 获取目录容器的边界信息
            const containerRect = tocContainer.getBoundingClientRect();
            const linkRect = activeLink.getBoundingClientRect();
            
            // 计算目录项相对于容器的位置
            const linkTop = linkRect.top - containerRect.top;
            const linkBottom = linkRect.bottom - containerRect.top;
            
            // 获取容器的可视区域高度
            const containerHeight = containerRect.height;
            
            // 检查目录项是否在可视区域内
            const isVisible = linkTop >= 0 && linkBottom <= containerHeight;
            
            if (!isVisible) {
                // 计算滚动位置
                let scrollTop;
                
                if (linkTop < 0) {
                    // 目录项在可视区域上方，滚动到顶部
                    scrollTop = tocContainer.scrollTop + linkTop - 10; // 留出10px边距
                } else {
                    // 目录项在可视区域下方，滚动到底部
                    scrollTop = tocContainer.scrollTop + linkBottom - containerHeight + 10; // 留出10px边距
                }
                
                // 确保滚动位置在有效范围内
                scrollTop = Math.max(0, Math.min(scrollTop, tocContainer.scrollHeight - containerHeight));
                
                // 平滑滚动到目标位置
                tocContainer.scrollTo({
                    top: scrollTop,
                    behavior: 'smooth'
                });
            }
        }
        
        // 暴露更新函数，供外部调用
        window.updateTocElements = updateElements;
    }
    
    /**
     * 将生成的目录插入到页面中
     * 
     * @param {string} tocHTML - 生成的目录HTML字符串
     * 
     * 处理流程：
     * 1. 查找Wiki.js原生目录容器
     * 2. 创建新的目录元素
     * 3. 将自定义目录插入到原生目录之前
     * 4. 隐藏原生目录
     */
    function insertTOC(tocHTML) {
        // 查找Wiki.js原生目录容器
        const tocContainer = document.querySelector(config.tocSelector);
        
        if (tocContainer) {
            // 创建新的目录元素
            const newToc = document.createElement('div');
            newToc.innerHTML = tocHTML;
            
            // 将自定义目录插入到原生目录之前
            tocContainer.parentNode.insertBefore(newToc.firstElementChild, tocContainer);
            
            // 隐藏原生目录
            tocContainer.style.display = 'none';
        }
    }
    
    /**
     * 为目录链接绑定点击事件
     * 
     * 功能：
     * - 阻止默认的锚点跳转行为
     * - 实现平滑滚动到目标标题位置
     * - 考虑固定导航栏的高度偏移
     */
    function bindEvents() {
        // 查找所有目录链接
        const links = document.querySelectorAll('.wiki-toc-link');
        
        // 为每个链接绑定点击事件
        links.forEach(link => {
            link.addEventListener('click', function(e) {
                // 阻止默认的锚点跳转
                e.preventDefault();
                
                // 获取目标ID（去掉#号）
                const targetId = this.getAttribute('href').substring(1);
                
                // 查找目标标题元素
                const target = document.getElementById(targetId);
                
                if (target) {
                    // 计算滚动位置，考虑偏移量
                    const top = target.offsetTop - config.scrollOffset;
                    
                    // 平滑滚动到目标位置
                    window.scrollTo({
                        top: top,
                        behavior: 'smooth'
                    });
                }
            });
        });
        
        // 绑定滚动监听事件，实现目录高亮
        bindScrollEvents();
    }
    
    /**
     * 添加自定义样式到页面
     * 
     * 包含的样式：
     * - 目录容器样式（透明背景、滚动条、粘性定位）
     * - 目录标题样式
     * - 目录列表样式（层级缩进、悬停效果）
     * - 响应式设计（移动端适配）
     * - 自定义滚动条样式（Webkit和Firefox）
     */
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .wiki-toc-simple {
                background: transparent;
                border: none;
                border-radius: 6px;
                padding: 8px 12px;
                margin-bottom: 16px;
                max-height: 70vh;
                overflow-y: auto;
                position: sticky;
                top: 16px;
                /* 自定义滚动条样式 */
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
            }
            
            /* Webkit浏览器滚动条样式 */
            .wiki-toc-simple::-webkit-scrollbar {
                width: 6px;
            }
            
            .wiki-toc-simple::-webkit-scrollbar-track {
                background: transparent;
                border-radius: 3px;
            }
            
            .wiki-toc-simple::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.3);
                border-radius: 3px;
                border: none;
            }
            
            .wiki-toc-simple::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.5);
            }
            
            .wiki-toc-simple::-webkit-scrollbar-corner {
                background: transparent;
            }
            
            .wiki-toc-title {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 10px;
                color: white;
                border-bottom: 1px solid #007bff;
                padding-bottom: 6px;
            }
            
            .wiki-toc-simple .wiki-toc-list{
                margin: 0 0 0 -24px;
            }
            
            .wiki-toc-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .wiki-toc-item {
                margin: 2px 0;
            }
            
            .wiki-toc-link {
                display: block;
                padding: 4px 8px;
                color: white;
                text-decoration: none;
                border-radius: 3px;
                transition: all 0.2s;
                font-size: 13px;
                line-height: 1.3;
            }
            
            .wiki-toc-link:hover {
                background-color: rgba(255, 255, 255, 0.1);
                color: #007bff;
            }
            
            .wiki-toc-item[data-level="1"] .wiki-toc-link {
                font-weight: bold;
                color: white;
                padding-left: 4px;
            }
            
            .wiki-toc-item[data-level="1"] .wiki-toc-link:hover {
                background-color: rgba(255, 255, 255, 0.15);
                padding-left: 4px;
            }
            
            .wiki-toc-item[data-level="2"] .wiki-toc-link {
                font-weight: 600;
                color: white;
            }
            
            /* 当前活跃目录项的高亮样式 */
            .wiki-toc-link.wiki-toc-active {
                background-color: rgba(0, 123, 255, 0.3) !important;
                color: #007bff !important;
                border-left: 3px solid #007bff;
                padding-left: 5px;
            }
            
            /* 一级目录活跃状态特殊样式 */
            .wiki-toc-item[data-level="1"] .wiki-toc-link.wiki-toc-active {
                background-color: rgba(0, 123, 255, 0.4) !important;
                color: #007bff !important;
                font-weight: bold;
            }
            
            @media (max-width: 768px) {
                .wiki-toc-simple {
                    position: static;
                    max-height: none;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * 初始化脚本
     * 
     * 执行顺序：
     * 1. 添加自定义样式
     * 2. 生成目录
     */
    function init() {
        addStyles();
        generateTOC();
    }
    
    /**
     * 页面加载完成后执行初始化
     * 
     * 兼容性处理：
     * - 如果页面还在加载中，等待DOMContentLoaded事件
     * - 如果页面已加载完成，直接执行初始化
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    /**
     * 暴露API到全局作用域
     * 
     * 可用方法：
     * - refresh(): 重新生成目录
     * - remove(): 移除目录
     * - config: 配置对象（可修改）
     * - updateElements(): 更新标题和目录元素列表（用于动态内容）
     */
    window.wikiTOCSimple = {
        version: '1.0.2',
        refresh: generateTOC,
        remove: removeExistingTOC,
        config: config,
        updateElements: () => {
            if (window.updateTocElements) {
                window.updateTocElements();
            }
        }
    };
    
})(); 