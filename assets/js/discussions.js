// GitHub Discussions를 블로그처럼 표시
const OWNER = 'gstreamer101';
const REPO = 'gstreamer101.github.io';
const DISCUSSIONS_URL = `https://github.com/${OWNER}/${REPO}/discussions`;

async function fetchDiscussions() {
    const query = `
        query {
            repository(owner: "${OWNER}", name: "${REPO}") {
                discussions(first: 20, orderBy: {field: CREATED_AT, direction: DESC}) {
                    edges {
                        node {
                            id
                            title
                            body
                            createdAt
                            author {
                                login
                                avatarUrl
                            }
                            category {
                                name
                                emoji
                            }
                            comments {
                                totalCount
                            }
                            upvoteCount
                            url
                        }
                    }
                }
            }
        }
    `;

    try {
        const response = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
        });

        const data = await response.json();

        if (data.errors) {
            console.error('GraphQL Error:', data.errors);
            displayError('discussions 로드 중 오류가 발생했습니다.');
            return;
        }

        const discussions = data.data.repository.discussions.edges;
        displayDiscussions(discussions);
    } catch (error) {
        console.error('Error fetching discussions:', error);
        displayError('discussions를 불러올 수 없습니다. 나중에 다시 시도해주세요.');
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

function displayDiscussions(discussions) {
    const container = document.getElementById('discussions-list');

    if (discussions.length === 0) {
        container.innerHTML = '<div class="no-discussions">아직 토론이 없습니다. 첫 번째 토론을 시작해보세요!</div>';
        return;
    }

    const discussionsHTML = discussions.map(({ node }) => `
        <article class="discussion-card">
            <div class="discussion-header">
                <div class="category-badge">
                    ${node.category ? `<span class="category-emoji">${node.category.emoji}</span>` : ''}
                    <span class="category-name">${node.category ? node.category.name : '일반'}</span>
                </div>
                <div class="discussion-meta">
                    <span class="vote-count">👍 ${node.upvoteCount}</span>
                    <span class="comment-count">💬 ${node.comments.totalCount}</span>
                </div>
            </div>

            <h2 class="discussion-title">
                <a href="${node.url}" target="_blank" rel="noopener noreferrer">
                    ${node.title}
                </a>
            </h2>

            <p class="discussion-body">${truncateText(node.body)}</p>

            <div class="discussion-footer">
                <div class="author-info">
                    <img src="${node.author.avatarUrl}" alt="${node.author.login}" class="author-avatar">
                    <div class="author-details">
                        <span class="author-name">${node.author.login}</span>
                        <span class="post-date">${formatDate(node.createdAt)}</span>
                    </div>
                </div>
                <a href="${node.url}" class="read-more" target="_blank" rel="noopener noreferrer">
                    토론 보기 →
                </a>
            </div>
        </article>
    `).join('');

    container.innerHTML = discussionsHTML;
}

function displayError(message) {
    const container = document.getElementById('discussions-list');
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

// 페이지 로드 시 discussions 가져오기
document.addEventListener('DOMContentLoaded', fetchDiscussions);
