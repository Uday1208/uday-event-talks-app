/* ==========================================================================
   BigQuery Release Notes Engine - Frontend Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // State management
    let rawReleases = [];
    let parsedUpdates = [];
    let filteredUpdates = [];
    let selectedUpdateId = null;
    let currentCategoryFilter = 'all';
    let currentSearchQuery = '';

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = refreshBtn.querySelector('.spinner-icon');
    const syncStatus = document.getElementById('sync-status');
    
    // Stats elements
    const statFeatures = document.getElementById('stat-features');
    const statAnnouncements = document.getElementById('stat-announcements');
    const statChanges = document.getElementById('stat-changes');
    const statIssues = document.getElementById('stat-issues');
    
    // Search & Filter elements
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const categoryFiltersContainer = document.getElementById('category-filters-container');
    const feedContainer = document.getElementById('feed-container');
    const noResultsState = document.getElementById('no-results');

    // Composer elements
    const composerEmptyState = document.getElementById('composer-empty-state');
    const composerActiveForm = document.getElementById('composer-active-form');
    const composerSelectedTitle = document.getElementById('composer-selected-title');
    const composerSelectedBadge = document.getElementById('composer-selected-badge');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const charProgressCircle = document.getElementById('char-progress-circle');
    const tweetSourceLink = document.getElementById('tweet-source-link');
    const copyTweetBtn = document.getElementById('copy-tweet-btn');
    const tweetBtn = document.getElementById('tweet-btn');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // Circular progress ring setup
    const circleRadius = charProgressCircle.r.baseVal.value;
    const circleCircumference = circleRadius * 2 * Math.PI;
    charProgressCircle.style.strokeDasharray = `${circleCircumference} ${circleCircumference}`;
    charProgressCircle.style.strokeDashoffset = circleCircumference;

    // --- Helper Functions ---

    // Show toast notifications
    function showToast(message, isError = false) {
        toastMessage.textContent = message;
        if (isError) {
            toast.classList.add('error');
        } else {
            toast.classList.remove('error');
        }
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Format UNIX timestamp to local readable string
    function formatLastUpdated(timestamp) {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
    }

    // Calculate Twitter character length taking URL wrapping into account
    function calculateTwitterLength(text) {
        // Twitter wraps any URL to 23 characters
        const urlRegex = /https?:\/\/[^\s]+/g;
        let length = text.length;
        const matches = text.match(urlRegex) || [];
        
        matches.forEach(url => {
            length = length - url.length + 23;
        });
        
        return length;
    }

    // Strip HTML to get plain text
    function stripHtml(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.textContent || temp.innerText || '';
    }

    // Parse HTML string from feed entry and split it by h3 headings
    function parseEntryContent(entry) {
        const temp = document.createElement('div');
        temp.innerHTML = entry.content_html;
        
        const updates = [];
        let currentCategory = 'General';
        let currentNodes = [];
        let subIndex = 0;

        // Walk through child nodes of the entry content
        Array.from(temp.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'h3') {
                // We reached a new category. Save the preceding one if it has content
                if (currentNodes.length > 0) {
                    const htmlContent = currentNodes.map(n => n.outerHTML || n.textContent).join('');
                    const textContent = stripHtml(htmlContent);
                    
                    updates.push(createUpdateObject(entry, currentCategory, htmlContent, textContent, subIndex++));
                    currentNodes = [];
                }
                currentCategory = node.textContent.trim();
            } else {
                currentNodes.push(node);
            }
        });

        // Push the final group
        if (currentNodes.length > 0) {
            const htmlContent = currentNodes.map(n => n.outerHTML || n.textContent).join('');
            const textContent = stripHtml(htmlContent);
            updates.push(createUpdateObject(entry, currentCategory, htmlContent, textContent, subIndex));
        }

        return updates;
    }

    // Create a structured update object
    function createUpdateObject(entry, category, htmlContent, textContent, subIndex) {
        // Clean category name
        const cleanCategory = category.trim();
        // Generate an anchor link if available in the entry link, otherwise point to main link
        let link = entry.link;
        // Check if there's a specific anchor for this date
        const dateSlug = entry.title.replace(/[\s,]+/g, '_');
        if (link && !link.includes('#')) {
            link = `${link}#${dateSlug}`;
        }

        // Unique ID
        const id = `${dateSlug}_${subIndex}`;

        return {
            id,
            date: entry.title,
            timestamp: entry.updated,
            category: cleanCategory,
            contentHtml: htmlContent,
            contentText: textContent,
            link
        };
    }

    // Process all feed entries
    function processReleases(releases) {
        let allUpdates = [];
        releases.forEach(entry => {
            const updates = parseEntryContent(entry);
            allUpdates = allUpdates.concat(updates);
        });
        
        // Sort updates: newest first based on date. The XML comes in order, but safety first.
        // We can sort them by parsing their dates or keep original feed order (newest is always first)
        return allUpdates;
    }

    // Calculate metrics/stats for dashboard
    function updateDashboardStats(updates) {
        const stats = {
            feature: 0,
            announcement: 0,
            change: 0,
            issue: 0
        };

        updates.forEach(up => {
            const cat = up.category.toLowerCase();
            if (cat.includes('feature')) stats.feature++;
            else if (cat.includes('announcement')) stats.announcement++;
            else if (cat.includes('change')) stats.change++;
            else if (cat.includes('issue') || cat.includes('warning')) stats.issue++;
        });

        // Animate counter values
        animateCounter(statFeatures, stats.feature);
        animateCounter(statAnnouncements, stats.announcements || stats.announcement);
        animateCounter(statChanges, stats.change);
        animateCounter(statIssues, stats.issue);
    }

    function animateCounter(element, targetValue) {
        let current = 0;
        const duration = 800; // ms
        const steps = 40;
        const stepValue = targetValue / steps;
        const stepTime = duration / steps;
        
        const interval = setInterval(() => {
            current += stepValue;
            if (current >= targetValue) {
                element.textContent = targetValue;
                clearInterval(interval);
            } else {
                element.textContent = Math.floor(current);
            }
        }, stepTime);
    }

    // Fetch data from Flask backend
    async function fetchReleaseNotes(forceRefresh = false) {
        // Set loading states
        refreshIcon.classList.add('loading');
        syncStatus.textContent = 'Syncing...';
        syncStatus.parentElement.querySelector('.pulse-dot').classList.add('syncing');
        
        if (forceRefresh) {
            feedContainer.innerHTML = `
                <div class="skeleton-loader-container">
                    <div class="skeleton-card"></div>
                    <div class="skeleton-card"></div>
                    <div class="skeleton-card"></div>
                </div>
            `;
        }

        try {
            const url = forceRefresh ? '/api/releases?refresh=true' : '/api/releases';
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                rawReleases = data.releases;
                parsedUpdates = processReleases(rawReleases);
                
                updateDashboardStats(parsedUpdates);
                applyFiltersAndRender();
                
                syncStatus.textContent = `Updated: ${formatLastUpdated(data.updated_at)}`;
                if (forceRefresh) {
                    showToast('Successfully fetched latest release notes!');
                }
            } else {
                throw new Error(data.error || 'Unknown error fetching releases');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            syncStatus.textContent = 'Failed to sync';
            showToast('Failed to refresh release notes: ' + error.message, true);
            
            // If we have no cards showing, render an error message inside feed
            if (parsedUpdates.length === 0) {
                feedContainer.innerHTML = `
                    <div class="no-results-state">
                        <h3 style="color: var(--color-deprecation)">Sync Failed</h3>
                        <p>Could not load release notes. Please check your internet connection or backend server and try again.</p>
                        <button id="retry-btn" class="btn btn-secondary" style="margin-top: 1rem;">Retry Sync</button>
                    </div>
                `;
                document.getElementById('retry-btn').addEventListener('click', () => fetchReleaseNotes(true));
            }
        } finally {
            refreshIcon.classList.remove('loading');
            syncStatus.parentElement.querySelector('.pulse-dot').classList.remove('syncing');
        }
    }

    // Compose Tweet Draft text
    function composeTweetDraft(update) {
        const catEmoji = getCategoryEmoji(update.category);
        const prefix = `${catEmoji} BigQuery ${update.category} (${update.date}): `;
        const link = update.link || 'https://docs.cloud.google.com/bigquery/docs/release-notes';
        const suffix = ` #BigQuery #GoogleCloud`;
        
        // Clean the body text: replace multiple spaces/newlines
        let body = update.contentText
            .replace(/\s+/g, ' ')
            .replace(/Click to expand/gi, '')
            .trim();
        
        // Available space for body:
        // Limit is 280.
        // Prefix is variable length.
        // Link takes exactly 23 characters on Twitter.
        // Suffix (hashtags) is variable length.
        // Plus spaces in between: "prefix + body + space + link + suffix"
        const prefixLen = prefix.length;
        const linkLen = 23;
        const suffixLen = suffix.length;
        const spacingLen = 2; // space before link, space before suffix
        
        const maxBodyLen = 280 - prefixLen - linkLen - suffixLen - spacingLen;
        
        if (body.length > maxBodyLen) {
            // Subtract 3 for ellipsis
            body = body.substring(0, maxBodyLen - 3).trim() + '...';
        }
        
        return `${prefix}${body} ${link}${suffix}`;
    }

    // Helper to get category emojis for tweets
    function getCategoryEmoji(category) {
        const cat = category.toLowerCase();
        if (cat.includes('feature')) return '🚀';
        if (cat.includes('announcement')) return '📢';
        if (cat.includes('change')) return '⚙️';
        if (cat.includes('issue') || cat.includes('warning')) return '⚠️';
        if (cat.includes('deprecation')) return '🚫';
        return '📝';
    }

    // Helper to map category class names
    function getCategoryClassName(category) {
        const cat = category.toLowerCase();
        if (cat.includes('feature')) return 'feature';
        if (cat.includes('announcement')) return 'announcement';
        if (cat.includes('change')) return 'change';
        if (cat.includes('issue') || cat.includes('warning')) return 'issue';
        if (cat.includes('deprecation')) return 'deprecation';
        return 'general';
    }

    // Populate Sidebar Composer with selected update
    function selectUpdate(update) {
        selectedUpdateId = update.id;
        
        // Visual indicator on cards
        document.querySelectorAll('.release-card').forEach(card => {
            if (card.dataset.id === update.id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Hide empty state, show form
        composerEmptyState.style.display = 'none';
        composerActiveForm.style.display = 'flex';
        
        // Set Composer headers
        composerSelectedTitle.textContent = update.date;
        
        const catClass = getCategoryClassName(update.category);
        composerSelectedBadge.className = `badge badge-lg badge-${catClass}`;
        composerSelectedBadge.textContent = update.category;
        composerSelectedBadge.style.display = 'inline-block';
        
        // Populate text details
        const draftText = composeTweetDraft(update);
        tweetTextarea.value = draftText;
        
        // Update URL preview
        tweetSourceLink.href = update.link;
        tweetSourceLink.querySelector('span').textContent = update.link;

        updateCharacterCount();
    }

    // Update the progress ring and character counters
    function updateCharacterCount() {
        const text = tweetTextarea.value;
        const currentLength = calculateTwitterLength(text);
        const limit = 280;
        const remaining = limit - currentLength;
        
        charCounter.textContent = remaining;
        
        // Highlight states
        if (remaining < 0) {
            charCounter.className = 'char-counter danger';
            charProgressCircle.style.stroke = 'var(--color-deprecation)';
        } else if (remaining <= 20) {
            charCounter.className = 'char-counter warning';
            charProgressCircle.style.stroke = 'var(--color-issue)';
        } else {
            charCounter.className = 'char-counter';
            charProgressCircle.style.stroke = 'var(--accent-primary)';
        }

        // Circular progress calculation
        const percent = Math.min(100, Math.max(0, (currentLength / limit) * 100));
        const strokeOffset = circleCircumference - (percent / 100) * circleCircumference;
        charProgressCircle.style.strokeDashoffset = strokeOffset;
    }

    // Render parsed updates to the feed container
    function renderFeed(updates) {
        if (updates.length === 0) {
            feedContainer.innerHTML = '';
            noResultsState.style.display = 'block';
            return;
        }

        noResultsState.style.display = 'none';
        
        // Generate html strings for cards
        const cardsHtml = updates.map(up => {
            const catClass = getCategoryClassName(up.category);
            const isSelected = up.id === selectedUpdateId ? 'selected' : '';
            
            return `
                <article class="release-card card-${catClass} ${isSelected}" data-id="${up.id}" tabindex="0">
                    <header class="card-header">
                        <div class="card-meta">
                            <span class="badge badge-${catClass}">${up.category}</span>
                            <time class="card-date">${up.date}</time>
                        </div>
                        <button class="card-quick-tweet-btn" title="Quick tweet this" aria-label="Compose tweet for this update">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                        </button>
                    </header>
                    <div class="card-body">
                        ${up.contentHtml}
                    </div>
                    <span class="card-select-pill">Selected</span>
                </article>
            `;
        }).join('');

        feedContainer.innerHTML = cardsHtml;

        // Attach listeners to newly created card elements
        document.querySelectorAll('.release-card').forEach(card => {
            const id = card.dataset.id;
            const updateObj = updates.find(u => u.id === id);

            // Card click selects it
            card.addEventListener('click', (e) => {
                // If clicked on quick-tweet button, we select and focus composer
                const quickBtn = card.querySelector('.card-quick-tweet-btn');
                if (quickBtn.contains(e.target) || quickBtn === e.target) {
                    e.stopPropagation();
                    selectUpdate(updateObj);
                    tweetTextarea.focus();
                    
                    // Smooth scroll to composer on mobile
                    if (window.innerWidth <= 768) {
                        document.getElementById('composer-sidebar').scrollIntoView({ behavior: 'smooth' });
                    }
                    return;
                }

                selectUpdate(updateObj);
            });

            // Keyboard navigation (Enter key selects)
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    selectUpdate(updateObj);
                }
            });
        });
    }

    // Apply filter conditions (search text and category tab) and render cards
    function applyFiltersAndRender() {
        filteredUpdates = parsedUpdates.filter(up => {
            // 1. Category Filter
            const catMatch = currentCategoryFilter === 'all' || 
                             up.category.toLowerCase().includes(currentCategoryFilter);
            
            // 2. Search Filter
            const cleanQuery = currentSearchQuery.toLowerCase().trim();
            const searchMatch = !cleanQuery || 
                                up.date.toLowerCase().includes(cleanQuery) ||
                                up.category.toLowerCase().includes(cleanQuery) ||
                                up.contentText.toLowerCase().includes(cleanQuery);
                                
            return catMatch && searchMatch;
        });

        renderFeed(filteredUpdates);
    }

    // --- Event Listeners ---

    // Refresh button
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));

    // Category filter tabs
    categoryFiltersContainer.addEventListener('click', (e) => {
        const clickedTab = e.target.closest('.filter-tab');
        if (!clickedTab) return;

        // Toggle active visual tab state
        categoryFiltersContainer.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
        clickedTab.classList.add('active');

        // Filter and update list
        currentCategoryFilter = clickedTab.dataset.category;
        applyFiltersAndRender();
    });

    // Search bar input
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value;
        
        // Show/hide clear button
        if (currentSearchQuery.length > 0) {
            clearSearchBtn.style.display = 'block';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        
        applyFiltersAndRender();
    });

    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndRender();
        searchInput.focus();
    });

    // Composer inputs & actions
    tweetTextarea.addEventListener('input', updateCharacterCount);

    // Hashtag pills insert logic
    document.querySelectorAll('.hashtag-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const hashtag = pill.dataset.hashtag;
            let currentText = tweetTextarea.value;
            
            // Append with proper space padding
            if (currentText.includes(hashtag)) {
                showToast(`Hashtag ${hashtag} is already added.`);
                return;
            }

            if (currentText.endsWith(' ')) {
                tweetTextarea.value = currentText + hashtag;
            } else if (currentText.length > 0) {
                tweetTextarea.value = currentText + ' ' + hashtag;
            } else {
                tweetTextarea.value = hashtag;
            }

            updateCharacterCount();
            tweetTextarea.focus();
        });
    });

    // Copy to clipboard
    copyTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        if (!text) return;

        navigator.clipboard.writeText(text)
            .then(() => {
                showToast('Tweet text copied to clipboard!');
            })
            .catch(err => {
                console.error('Could not copy text: ', err);
                showToast('Failed to copy text. Please select and copy manually.', true);
            });
    });

    // Tweet on X / open dialog
    tweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        if (!text) return;

        const currentLength = calculateTwitterLength(text);
        if (currentLength > 280) {
            showToast('Tweet exceeds X character limit of 280!', true);
            return;
        }

        // Open sharing window
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'width=600,height=400,resizable=yes');
    });

    // Initialize application on load
    fetchReleaseNotes(false);
});
