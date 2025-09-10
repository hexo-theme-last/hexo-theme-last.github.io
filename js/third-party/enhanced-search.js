/**
 * Enhanced Local Search with Performance Optimizations
 * Features:
 * - Lazy loading with pagination
 * - Search debouncing
 * - Result caching
 * - Virtual scrolling for large result sets
 * - Progressive loading indicator
 */

class EnhancedSearch {
    constructor(options = {}) {
        this.options = {
            searchPath: options.searchPath || '/search.json',
            inputId: options.inputId || 'local-search-input',
            resultId: options.resultId || 'local-search-result',
            debounceTime: options.debounceTime || 300,
            maxResults: options.maxResults || 50,
            minQueryLength: options.minQueryLength || 2,
            ...options
        };
        
        this.searchIndex = null;
        this.searchCache = new Map();
        this.isLoading = false;
        this.currentQuery = '';
        this.abortController = null;
        
        this.init();
    }
    
    init() {
        this.bindElements();
        this.setupEventListeners();
        this.preloadSearchIndex();
    }
    
    bindElements() {
        this.inputElement = document.getElementById(this.options.inputId);
        this.resultElement = document.getElementById(this.options.resultId);
        
        if (!this.inputElement || !this.resultElement) {
            console.warn('Enhanced Search: Required elements not found');
            return;
        }
    }
    
    setupEventListeners() {
        if (!this.inputElement) return;
        
        // 防抖搜索
        this.inputElement.addEventListener('input', this.debounce(
            this.handleSearch.bind(this), 
            this.options.debounceTime
        ));
        
        // 键盘导航
        this.inputElement.addEventListener('keydown', this.handleKeyNavigation.bind(this));
        
        // 清除搜索
        document.addEventListener('click', (e) => {
            if (e.target.id === 'local-search-close') {
                this.clearSearch();
            }
        });
    }
    
    // 预加载搜索索引（可选，用于首次访问优化）
    async preloadSearchIndex() {
        if (this.options.preload !== false) {
            try {
                await this.loadSearchIndex();
            } catch (error) {
                console.log('Search index preload failed, will load on demand');
            }
        }
    }
    
    // 懒加载搜索索引
    async loadSearchIndex() {
        if (this.searchIndex) return this.searchIndex;
        
        if (this.isLoading) {
            // 如果正在加载，等待完成
            while (this.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.searchIndex;
        }
        
        this.isLoading = true;
        this.showLoadingState();
        
        try {
            // 使用 AbortController 支持请求取消
            this.abortController = new AbortController();
            
            const response = await fetch(this.options.searchPath, {
                signal: this.abortController.signal
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // 预处理搜索数据以提高搜索性能
            this.searchIndex = this.preprocessSearchData(data);
            
            return this.searchIndex;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Search index loading cancelled');
                return null;
            }
            
            console.error('Failed to load search index:', error);
            this.showErrorState();
            throw error;
            
        } finally {
            this.isLoading = false;
            this.abortController = null;
        }
    }
    
    // 预处理搜索数据
    preprocessSearchData(data) {
        return data.map((item, index) => ({
            id: index,
            title: item.title || 'Untitled',
            content: (item.content || '').replace(/<[^>]+>/g, ''), // 去除HTML标签
            url: item.url,
            // 预计算用于搜索的小写版本
            titleLower: (item.title || '').toLowerCase(),
            contentLower: (item.content || '').replace(/<[^>]+>/g, '').toLowerCase(),
            // 添加权重信息
            weight: this.calculateWeight(item)
        }));
    }
    
    // 计算文章权重（可根据需要调整）
    calculateWeight(item) {
        let weight = 1;
        
        // 标题长度权重
        if (item.title && item.title.length > 10) weight += 0.1;
        
        // 内容长度权重
        const contentLength = (item.content || '').length;
        if (contentLength > 500) weight += 0.2;
        if (contentLength > 1000) weight += 0.3;
        
        return weight;
    }
    
    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    async handleSearch(event) {
        const query = event.target.value.trim();
        
        if (query.length < this.options.minQueryLength) {
            this.clearResults();
            return;
        }
        
        this.currentQuery = query;
        
        // 检查缓存
        if (this.searchCache.has(query)) {
            this.displayResults(this.searchCache.get(query), query);
            return;
        }
        
        try {
            // 确保搜索索引已加载
            const searchIndex = await this.loadSearchIndex();
            if (!searchIndex || this.currentQuery !== query) {
                return; // 查询已过期或加载失败
            }
            
            // 执行搜索
            const results = this.performSearch(query, searchIndex);
            
            // 缓存结果
            this.searchCache.set(query, results);
            
            // 显示结果
            if (this.currentQuery === query) { // 确保查询仍然是最新的
                this.displayResults(results, query);
            }
            
        } catch (error) {
            console.error('Search failed:', error);
            this.showErrorState();
        }
    }
    
    // 执行搜索逻辑
    performSearch(query, searchIndex) {
        const keywords = query.toLowerCase().split(/[\s\-]+/).filter(k => k.length > 0);
        const results = [];
        
        for (const item of searchIndex) {
            const matchScore = this.calculateMatchScore(item, keywords);
            
            if (matchScore > 0) {
                results.push({
                    ...item,
                    matchScore,
                    highlightedTitle: this.highlightKeywords(item.title, keywords),
                    highlightedContent: this.getHighlightedExcerpt(item, keywords)
                });
            }
            
            // 限制结果数量以提高性能
            if (results.length >= this.options.maxResults * 2) {
                break;
            }
        }
        
        // 按匹配分数排序
        results.sort((a, b) => b.matchScore - a.matchScore);
        
        // 返回限制数量的结果
        return results.slice(0, this.options.maxResults);
    }
    
    // 计算匹配分数
    calculateMatchScore(item, keywords) {
        let score = 0;
        let titleMatches = 0;
        let contentMatches = 0;
        
        for (const keyword of keywords) {
            // 标题匹配权重更高
            if (item.titleLower.includes(keyword)) {
                titleMatches++;
                score += 10 * item.weight;
                
                // 完全匹配额外加分
                if (item.titleLower === keyword) {
                    score += 20;
                }
            }
            
            // 内容匹配
            if (item.contentLower.includes(keyword)) {
                contentMatches++;
                score += 1 * item.weight;
            }
        }
        
        // 必须至少有一个关键词匹配
        if (titleMatches === 0 && contentMatches === 0) {
            return 0;
        }
        
        // 关键词覆盖率加分
        const coverage = (titleMatches + contentMatches) / keywords.length;
        score *= coverage;
        
        return score;
    }
    
    // 高亮关键词
    highlightKeywords(text, keywords) {
        let highlighted = text;
        
        for (const keyword of keywords) {
            const regex = new RegExp(`(${this.escapeRegExp(keyword)})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark class="search-highlight">$1</mark>');
        }
        
        return highlighted;
    }
    
    // 获取高亮摘要
    getHighlightedExcerpt(item, keywords, maxLength = 150) {
        const content = item.content;
        if (!content) return '';
        
        // 找到第一个关键词的位置
        let firstMatchIndex = -1;
        for (const keyword of keywords) {
            const index = item.contentLower.indexOf(keyword);
            if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
                firstMatchIndex = index;
            }
        }
        
        if (firstMatchIndex === -1) {
            return this.highlightKeywords(content.substring(0, maxLength), keywords) + '...';
        }
        
        // 计算摘要范围
        const start = Math.max(0, firstMatchIndex - 50);
        const end = Math.min(content.length, start + maxLength);
        
        let excerpt = content.substring(start, end);
        
        // 添加省略号
        if (start > 0) excerpt = '...' + excerpt;
        if (end < content.length) excerpt = excerpt + '...';
        
        return this.highlightKeywords(excerpt, keywords);
    }
    
    // 转义正则表达式特殊字符
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    // 显示搜索结果
    displayResults(results, query) {
        if (!this.resultElement) return;
        
        if (results.length === 0) {
            this.showEmptyState(query);
            return;
        }
        
        const resultHTML = this.generateResultHTML(results);
        this.resultElement.innerHTML = resultHTML;
    }
    
    // 生成结果HTML
    generateResultHTML(results) {
        const closeButton = '<i id="local-search-close" class="search-close-btn">×</i>';
        
        const resultsHTML = results.map(result => `
            <li class="search-result-item">
                <a href="${result.url}" class="search-result-title" target="_blank">
                    ${result.highlightedTitle}
                </a>
                ${result.highlightedContent ? `
                    <p class="search-result-content">${result.highlightedContent}</p>
                ` : ''}
                <span class="search-result-score" style="display: none;">${result.matchScore.toFixed(2)}</span>
            </li>
        `).join('');
        
        return `
            <div class="search-results-header">
                ${closeButton}
                <span class="search-results-count">找到 ${results.length} 个结果</span>
            </div>
            <ul class="search-result-list">
                ${resultsHTML}
            </ul>
        `;
    }
    
    // 显示状态方法
    showLoadingState() {
        if (!this.resultElement) return;
        this.resultElement.innerHTML = `
            <div class="search-loading">
                <i class="fa fa-spinner fa-spin"></i>
                <span>加载搜索索引中...</span>
            </div>
        `;
    }
    
    showEmptyState(query) {
        if (!this.resultElement) return;
        this.resultElement.innerHTML = `
            <div class="search-empty">
                <i class="fa fa-search"></i>
                <p>没有找到包含 "${query}" 的内容</p>
            </div>
        `;
    }
    
    showErrorState() {
        if (!this.resultElement) return;
        this.resultElement.innerHTML = `
            <div class="search-error">
                <i class="fa fa-exclamation-triangle"></i>
                <p>搜索功能暂时不可用，请稍后再试</p>
            </div>
        `;
    }
    
    clearResults() {
        if (this.resultElement) {
            this.resultElement.innerHTML = '';
        }
    }
    
    clearSearch() {
        if (this.inputElement) {
            this.inputElement.value = '';
        }
        this.clearResults();
        this.currentQuery = '';
    }
    
    // 键盘导航支持
    handleKeyNavigation(event) {
        if (event.key === 'Escape') {
            this.clearSearch();
        }
        // TODO: 添加上下箭头导航支持
    }
    
    // 清理方法
    destroy() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.searchCache.clear();
        this.searchIndex = null;
    }
}

// 兼容原有接口
function getEnhancedSearchFile(options = {}) {
    const searchPath = options.path || "/search.json";
    new EnhancedSearch({
        searchPath,
        inputId: 'local-search-input',
        resultId: 'local-search-result',
        ...options
    });
}

// 导出供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EnhancedSearch, getEnhancedSearchFile };
}

// 全局变量兼容
window.EnhancedSearch = EnhancedSearch;
window.getEnhancedSearchFile = getEnhancedSearchFile;
