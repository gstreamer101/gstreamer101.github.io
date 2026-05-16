// GitHub Discussions를 블로그처럼 표시
const OWNER = 'gstreamer101';
const REPO = 'gstreamer101.github.io';
const DISCUSSIONS_URL = `https://github.com/${OWNER}/${REPO}/discussions`;

// 카테고리 설정
const FEATURED_CATEGORIES = ['Announcements', 'Polls'];
const GENERAL_CATEGORIES = ['General', 'Ideas', 'Q&A', 'Show and Tell'];

async function fetchDiscussions() {
    try {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
        };

        const token = localStorage.getItem('gh_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // 모든 discussions 가져오기 (페이지 단위)
        const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/discussions?per_page=50`;
        const response = await fetch(apiUrl, { headers });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error Response:', errorData);

            if (response.status === 404) {
                displayError('Discussions를 찾을 수 없습니다. 저장소가 올바른지 확인하세요.');
            } else if (response.status === 403) {
                displayError('API 레이트 제한에 도달했습니다. 잠시 후 다시 시도해주세요.<br><small>GitHub token을 설정하면 제한이 증가합니다.</small>');
            } else {
                displayError(`API 오류 (${response.status}): ${errorData.message || '알 수 없는 오류'}`);
            }
            return;
        }

        const discussions = await response.json();
        console.log('Discussions loaded:', discussions);

        if (!Array.isArray(discussions) || discussions.length === 0) {
            displayNoDiscussions();
            return;
        }

        // 카테고리별로 분류
        const featured = discussions.filter(d =>
            FEATURED_CATEGORIES.includes(d.category?.name)
        );
        const general = discussions.filter(d =>
            GENERAL_CATEGORIES.includes(d.category?.name) ||
            (!d.category?.name || !FEATURED_CATEGORIES.includes(d.category?.name))
        );

        displayLayout(featured, general);
    } catch (error) {
        console.error('Error fetching discussions:', error);
        const errorDetails = error.message || '알 수 없는 오류';
        displayError(`discussions를 불러올 수 없습니다.<br><small>오류: ${errorDetails}</small>`);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return '오늘 ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
        return '어제 ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
    }
}

function truncateText(text, length = 150) {
    if (!text) return '';
    const plainText = text.replace(/#+\s/g, '').trim();
    if (plainText.length > length) {
        return plainText.substring(0, length) + '...';
    }
    return plainText;
}

function createDiscussionCard(discussion) {
    const categoryEmoji = {
        'Announcements': '📢',
        'Polls': '🗳️',
        'General': '💬',
        'Ideas': '💡',
        'Q&A': '❓',
        'Show and Tell': '🎉'
    };

    const categoryName = discussion.category?.name || '일반';
    const emoji = categoryEmoji[categoryName] || '📌';

    return `
        <article class="discussion-card">
            <div class="discussion-header">
                <div class="category-badge">
                    <span class="category-emoji">${emoji}</span>
                    <span class="category-name">${categoryName}</span>
                </div>
                <div class="discussion-meta">
                    <span class="comment-count">💬 ${discussion.comments_count || 0}</span>
                </div>
            </div>

            <h2 class="discussion-title">
                <a href="${discussion.html_url}" target="_blank" rel="noopener noreferrer">
                    ${discussion.title}
                </a>
            </h2>

            <p class="discussion-body">${truncateText(discussion.body)}</p>

            <div class="discussion-footer">
                <div class="author-info">
                    <img src="${discussion.user.avatar_url}" alt="${discussion.user.login}" class="author-avatar">
                    <div class="author-details">
                        <span class="author-name">${discussion.user.login}</span>
                        <span class="post-date">${formatDate(discussion.created_at)}</span>
                    </div>
                </div>
                <a href="${discussion.html_url}" class="read-more" target="_blank" rel="noopener noreferrer">
                    보기 →
                </a>
            </div>
        </article>
    `;
}

function displayLayout(featured, general) {
    const container = document.getElementById('discussions-list');

    let html = '';

    // 상단: Featured (Announcements, Polls)
    if (featured.length > 0) {
        html += '<section class="featured-section">';
        html += '<h2 class="section-title">📌 주요 공지</h2>';
        html += '<div class="discussions-grid featured-grid">';
        featured.forEach(d => {
            html += createDiscussionCard(d);
        });
        html += '</div></section>';
    }

    // 하단: General (섞인 카테고리들)
    if (general.length > 0) {
        html += '<section class="general-section">';
        html += '<h2 class="section-title">🗨️ 커뮤니티 토론</h2>';
        html += '<div class="discussions-list-general">';
        general.forEach(d => {
            html += createDiscussionCard(d);
        });
        html += '</div></section>';
    }

    if (!html) {
        displayNoDiscussions();
        return;
    }

    container.innerHTML = html;
}

function displayNoDiscussions() {
    const container = document.getElementById('discussions-list');
    container.innerHTML = `
        <div class="no-discussions">
            아직 토론이 없습니다.
            <a href="${DISCUSSIONS_URL}/new" target="_blank">첫 번째 토론을 시작</a>해보세요! 🚀
        </div>
    `;
}

function displayError(message) {
    const container = document.getElementById('discussions-list');
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

// 페이지 로드 시 discussions 가져오기
document.addEventListener('DOMContentLoaded', fetchDiscussions);
