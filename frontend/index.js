document.addEventListener('DOMContentLoaded', () => {
    // Current application state
    const state = {
        activeTab: 'dashboard',
        charts: {},
        simulation: {
            intervalId: null,
            isRunning: false,
            commentsList: [],
            sentimentTimeline: [],
            emotionTotals: { joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0, neutral: 0 },
            commentCount: 0
        },
        bulk: {
            file: null,
            fileId: null,
            columns: []
        }
    };

    // DOM Elements
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    
    // Single Analysis Elements
    const singleTextarea = document.getElementById('singleCommentText');
    const singleCharCounter = document.getElementById('singleCharCounter');
    const btnAnalyzeSingle = document.getElementById('btnAnalyzeSingle');
    const btnClearSingle = document.getElementById('btnClearSingle');
    const singleResultsSection = document.getElementById('singleResultsSection');
    
    // Bulk Upload Elements
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const progressPanel = document.getElementById('progressPanel');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');
    const progressStatus = document.getElementById('progressStatus');
    const bulkResultsSection = document.getElementById('bulkResultsSection');
    const btnDownloadBulk = document.getElementById('btnDownloadBulk');
    
    // Modal Column Selector Elements
    const columnModal = document.getElementById('columnModal');
    const btnConfirmColumn = document.getElementById('btnConfirmColumn');
    const btnCancelColumn = document.getElementById('btnCancelColumn');
    const columnSelect = document.getElementById('columnSelect');
    
    // Simulator Elements
    const btnStartSim = document.getElementById('btnStartSim');
    const btnStopSim = document.getElementById('btnStopSim');
    const platformSelect = document.getElementById('platformSelect');
    const simQueryInput = document.getElementById('simQueryInput');
    const streamContainer = document.getElementById('streamContainer');
    const simIndicator = document.getElementById('simIndicator');

    // ----------------------------------------------------
    // Tab Navigation
    // ----------------------------------------------------
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    function switchTab(tabId) {
        state.activeTab = tabId;
        
        // Update Nav Menu UI
        navItems.forEach(item => {
            if (item.getAttribute('data-tab') === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update Pages Visibility
        pages.forEach(page => {
            if (page.id === `${tabId}Page`) {
                page.classList.add('active');
            } else {
                page.classList.remove('active');
            }
        });

        // Specific Tab Actions
        if (tabId === 'dashboard') {
            loadDashboardStats();
        } else if (tabId !== 'simulator') {
            // Stop simulator if we navigate away
            stopSimulator();
        }
    }

    // ----------------------------------------------------
    // Chart Initialization & Helpers
    // ----------------------------------------------------
    function getChartColors() {
        return {
            positive: '#10b981',
            negative: '#f43f5e',
            neutral: '#64748b',
            primary: '#8b5cf6',
            secondary: '#06b6d4',
            joy: '#fcd34d',
            sadness: '#60a5fa',
            anger: '#f87171',
            fear: '#c084fc',
            surprise: '#22d3ee'
        };
    }

    function destroyChart(chartName) {
        if (state.charts[chartName]) {
            state.charts[chartName].destroy();
            delete state.charts[chartName];
        }
    }

    function renderSentimentChart(canvasId, data, chartName) {
        destroyChart(chartName);
        const ctx = document.getElementById(canvasId).getContext('2d');
        const colors = getChartColors();
        
        state.charts[chartName] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Positive', 'Neutral', 'Negative'],
                datasets: [{
                    data: [data.positive, data.neutral, data.negative],
                    backgroundColor: [colors.positive, colors.neutral, colors.negative],
                    borderColor: 'rgba(6, 9, 19, 0.8)',
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Plus Jakarta Sans', size: 12 }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    function renderEmotionChart(canvasId, emotionsData, chartName, type = 'bar') {
        destroyChart(chartName);
        const ctx = document.getElementById(canvasId).getContext('2d');
        const colors = getChartColors();
        
        const labels = Object.keys(emotionsData).map(e => e.toUpperCase());
        const values = Object.values(emotionsData);
        
        const backgroundColors = [
            colors.joy, colors.sadness, colors.anger, colors.fear, colors.surprise, colors.neutral
        ];

        const chartConfig = {
            type: type,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Emotion Intensity',
                    data: values,
                    backgroundColor: type === 'radar' ? 'rgba(139, 92, 246, 0.2)' : backgroundColors,
                    borderColor: type === 'radar' ? colors.primary : 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    pointBackgroundColor: colors.secondary
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: type === 'bar' ? {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' },
                        beginAtZero: true
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                } : {
                    r: {
                        grid: { color: 'rgba(255, 255, 255, 0.08)' },
                        angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
                        pointLabels: { color: '#94a3b8', font: { size: 10 } },
                        ticks: { display: false },
                        suggestedMin: 0,
                        suggestedMax: 1
                    }
                }
            }
        };

        state.charts[chartName] = new Chart(ctx, chartConfig);
    }

    // ----------------------------------------------------
    // Canvas Word Cloud Generator
    // ----------------------------------------------------
    function renderWordCloud(words, canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Match high resolution
        const width = canvas.parentElement.clientWidth || 400;
        const height = canvas.parentElement.clientHeight || 280;
        canvas.width = width * 2;
        canvas.height = height * 2;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        
        ctx.scale(2, 2);
        ctx.clearRect(0, 0, width, height);
        
        if (!words || words.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Plus Jakarta Sans';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', width / 2, height / 2);
            return;
        }
        
        const centerX = width / 2;
        const centerY = height / 2;
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f43f5e', '#a78bfa', '#22d3ee', '#fbbf24', '#f87171'];
        
        words.forEach((word, idx) => {
            const size = Math.max(28 - (idx * 2), 12);
            ctx.font = `bold ${size}px Outfit`;
            ctx.fillStyle = colors[idx % colors.length];
            
            // Generate a simple spiral pattern to avoid overlap
            const angle = idx * 0.95;
            const radius = idx * 18;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            
            ctx.fillText(word, x, y);
        });
    }

    // ----------------------------------------------------
    // Dashboard Stats Handler
    // ----------------------------------------------------
    function loadDashboardStats() {
        // Load initial dummy statistics representing preloaded database metrics
        const dummyStats = {
            total_comments: 1482,
            average_sentiment: 0.24,
            positivity_rate: 62.4,
            dominant_emotion: 'Joy (42%)',
            distribution: { positive: 925, neutral: 341, negative: 216 },
            emotions: { joy: 0.42, sadness: 0.12, anger: 0.08, fear: 0.05, surprise: 0.15, neutral: 0.18 },
            keywords: ['awesome', 'love', 'bitcoin', 'ai', 'update', 'broken', 'worst', 'masterpiece', 'design', 'chatgpt']
        };

        // Render dashboard values
        document.getElementById('dashTotalComments').innerText = dummyStats.total_comments;
        document.getElementById('dashSentimentIndex').innerText = dummyStats.average_sentiment.toFixed(2);
        document.getElementById('dashPositivityRate').innerText = dummyStats.positivity_rate + '%';
        document.getElementById('dashDominantEmotion').innerText = dummyStats.dominant_emotion;

        // Render charts
        renderSentimentChart('dashSentimentChart', dummyStats.distribution, 'dashSentiment');
        renderEmotionChart('dashEmotionChart', dummyStats.emotions, 'dashEmotion', 'radar');
        renderWordCloud(dummyStats.keywords, 'wordCloudCanvas');
    }

    // ----------------------------------------------------
    // Single Analysis Handler
    // ----------------------------------------------------
    singleTextarea.addEventListener('input', () => {
        const charCount = singleTextarea.value.length;
        singleCharCounter.innerText = `${charCount} / 500`;
    });

    btnClearSingle.addEventListener('click', () => {
        singleTextarea.value = '';
        singleCharCounter.innerText = '0 / 500';
        singleResultsSection.style.display = 'none';
        destroyChart('singleEmotion');
    });

    btnAnalyzeSingle.addEventListener('click', async () => {
        const text = singleTextarea.value.trim();
        if (!text) {
            alert('Please enter a comment to analyze.');
            return;
        }

        btnAnalyzeSingle.disabled = true;
        btnAnalyzeSingle.innerHTML = `<i class="pulse-indicator"></i> Analyzing...`;
        
        try {
            const response = await fetch('/api/analyze/single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!response.ok) {
                throw new Error('API server returned error');
            }

            const data = await response.json();
            displaySingleResult(data);
        } catch (error) {
            console.error('Error analyzing single comment:', error);
            alert('Could not complete analysis. Check server connection.');
        } finally {
            btnAnalyzeSingle.disabled = false;
            btnAnalyzeSingle.innerHTML = `<i class="fas fa-magic"></i> Analyze Comment`;
        }
    });

    function displaySingleResult(data) {
        singleResultsSection.style.display = 'block';
        singleResultsSection.scrollIntoView({ behavior: 'smooth' });

        // Update badge
        const badge = document.getElementById('singleSentimentBadge');
        badge.className = `badge ${data.sentiment}`;
        badge.innerText = data.sentiment;

        // Sentiment compound & subjectivity sliders
        // compound goes from -1 to 1, map it to 0-100%
        const scorePct = Math.round(((data.scores.compound + 1) / 2) * 100);
        document.getElementById('singleCompoundVal').innerText = data.scores.compound.toFixed(2);
        document.getElementById('singleCompoundFill').style.width = `${scorePct}%`;

        const subPct = Math.round(data.subjectivity * 100);
        document.getElementById('singleSubjectivityVal').innerText = data.subjectivity.toFixed(2);
        document.getElementById('singleSubjectivityFill').style.width = `${subPct}%`;

        // Tags
        const keywordsContainer = document.getElementById('singleKeywords');
        keywordsContainer.innerHTML = '';
        data.key_phrases.forEach(kw => {
            const span = document.createElement('span');
            span.className = 'tag';
            span.innerText = kw;
            keywordsContainer.appendChild(span);
        });
        if (data.key_phrases.length === 0) {
            keywordsContainer.innerHTML = '<span class="text-muted">None detected</span>';
        }

        const tagsContainer = document.getElementById('singleHashtags');
        tagsContainer.innerHTML = '';
        data.hashtags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag hashtag';
            span.innerText = tag;
            tagsContainer.appendChild(span);
        });
        data.mentions.forEach(m => {
            const span = document.createElement('span');
            span.className = 'tag mention';
            span.innerText = m;
            tagsContainer.appendChild(span);
        });
        if (data.hashtags.length === 0 && data.mentions.length === 0) {
            tagsContainer.innerHTML = '<span class="text-muted">None detected</span>';
        }

        const emojiContainer = document.getElementById('singleEmojis');
        emojiContainer.innerHTML = '';
        data.emojis.forEach(emo => {
            const span = document.createElement('span');
            span.className = 'emoji-badge';
            span.innerText = emo;
            emojiContainer.appendChild(span);
        });
        if (data.emojis.length === 0) {
            emojiContainer.innerHTML = '<span class="text-muted">None detected</span>';
        }

        // Render emotion polarities chart
        renderEmotionChart('singleEmotionChart', data.emotions, 'singleEmotion', 'bar');
    }

    // ----------------------------------------------------
    // Bulk Analysis & File Upload Handler
    // ----------------------------------------------------
    uploadZone.addEventListener('click', () => fileInput.click());

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileSelect(fileInput.files[0]);
        }
    });

    function handleFileSelect(file) {
        const isCsv = file.name.endsWith('.csv');
        const isJson = file.name.endsWith('.json');
        
        if (!isCsv && !isJson) {
            alert('Invalid file format. Please upload a CSV or JSON file.');
            return;
        }

        state.bulk.file = file;
        
        // Read headers for CSV to allow column selection
        if (isCsv) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const text = e.target.result;
                const firstLine = text.split('\n')[0];
                const columns = firstLine.split(',').map(c => c.replace(/['"]+/g, '').trim());
                showColumnSelector(columns);
            };
            reader.readAsText(file.slice(0, 5000)); // Just read the beginning
        } else {
            // JSON files process directly (auto-detect)
            startBulkAnalysis(null);
        }
    }

    function showColumnSelector(columns) {
        columnSelect.innerHTML = '';
        columns.forEach(col => {
            if (col.trim()) {
                const opt = document.createElement('option');
                opt.value = col;
                opt.innerText = col;
                columnSelect.appendChild(opt);
            }
        });
        
        columnModal.style.display = 'flex';
    }

    btnCancelColumn.addEventListener('click', () => {
        columnModal.style.display = 'none';
        state.bulk.file = null;
    });

    btnConfirmColumn.addEventListener('click', () => {
        columnModal.style.display = 'none';
        const col = columnSelect.value;
        startBulkAnalysis(col);
    });

    async function startBulkAnalysis(selectedColumn) {
        if (!state.bulk.file) return;

        progressPanel.style.display = 'block';
        bulkResultsSection.style.display = 'none';
        progressFill.style.width = '0%';
        progressPercent.innerText = '0%';
        progressStatus.innerText = 'Uploading file to server...';

        const formData = new FormData();
        formData.append('file', state.bulk.file);
        if (selectedColumn) {
            formData.append('column_name', selectedColumn);
        }

        // Simulate progress bar movement for visual effect
        let progress = 0;
        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += 5;
                progressFill.style.width = `${progress}%`;
                progressPercent.innerText = `${progress}%`;
                progressStatus.innerText = 'Analyzing comments...';
            }
        }, 300);

        try {
            const response = await fetch('/api/analyze/bulk', {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Failed processing bulk comments');
            }

            progressFill.style.width = '100%';
            progressPercent.innerText = '100%';
            progressStatus.innerText = 'Analysis completed successfully!';

            const result = await response.json();
            
            setTimeout(() => {
                progressPanel.style.display = 'none';
                displayBulkResult(result);
            }, 600);

        } catch (error) {
            clearInterval(progressInterval);
            console.error('Bulk analysis error:', error);
            progressStatus.innerText = 'Error: ' + error.message;
            progressFill.style.backgroundColor = 'var(--negative)';
            alert('Error running bulk analysis: ' + error.message);
        }
    }

    function displayBulkResult(data) {
        bulkResultsSection.style.display = 'block';
        bulkResultsSection.scrollIntoView({ behavior: 'smooth' });

        state.bulk.fileId = data.file_id;

        // Update metrics cards
        document.getElementById('bulkTotalComments').innerText = data.total_comments;
        document.getElementById('bulkAvgSentiment').innerText = data.average_sentiment_score.toFixed(2);
        document.getElementById('bulkAvgSubjectivity').innerText = data.average_subjectivity.toFixed(2);
        
        // Dominant emotion
        let dominantEmotion = 'Neutral';
        let maxVal = 0;
        for (const [emo, val] of Object.entries(data.average_emotions)) {
            if (emo !== 'neutral' && val > maxVal) {
                maxVal = val;
                dominantEmotion = emo.charAt(0).toUpperCase() + emo.slice(1);
            }
        }
        document.getElementById('bulkDominantEmotion').innerText = `${dominantEmotion} (${Math.round(maxVal * 100)}%)`;

        // Render charts
        renderSentimentChart('bulkSentimentChart', data.sentiment_distribution, 'bulkSentiment');
        renderEmotionChart('bulkEmotionChart', data.average_emotions, 'bulkEmotion', 'bar');

        // Render preview table
        const tbody = document.getElementById('previewTableBody');
        tbody.innerHTML = '';
        
        data.preview_data.forEach((row, index) => {
            const tr = document.createElement('tr');
            
            const tdIndex = document.createElement('td');
            tdIndex.innerText = index + 1;
            tr.appendChild(tdIndex);
            
            const tdComment = document.createElement('td');
            tdComment.innerText = row.text;
            tdComment.title = row.text;
            tr.appendChild(tdComment);
            
            const tdSentiment = document.createElement('td');
            const span = document.createElement('span');
            span.className = `badge ${row.sentiment}`;
            span.innerText = row.sentiment;
            tdSentiment.appendChild(span);
            tr.appendChild(tdSentiment);
            
            const tdScore = document.createElement('td');
            tdScore.innerText = row.scores.compound.toFixed(2);
            tr.appendChild(tdScore);
            
            tbody.appendChild(tr);
        });
    }

    btnDownloadBulk.addEventListener('click', () => {
        if (state.bulk.fileId) {
            window.location.href = `/api/download/${state.bulk.fileId}`;
        }
    });

    // ----------------------------------------------------
    // Live Streaming Simulator
    // ----------------------------------------------------
    btnStartSim.addEventListener('click', startSimulator);
    btnStopSim.addEventListener('click', stopSimulator);

    function startSimulator() {
        const platform = platformSelect.value;
        const query = simQueryInput.value.trim() || 'tech';
        
        if (state.simulation.isRunning) {
            // Already running, stop current first
            stopSimulator();
        }
        
        state.simulation.isRunning = true;
        btnStartSim.style.display = 'none';
        btnStopSim.style.display = 'inline-flex';
        simIndicator.style.display = 'inline-block';
        
        // Reset simulation metrics
        state.simulation.commentsList = [];
        state.simulation.sentimentTimeline = [];
        state.simulation.emotionTotals = { joy: 0, sadness: 0, anger: 0, fear: 0, surprise: 0, neutral: 0 };
        state.simulation.commentCount = 0;
        
        streamContainer.innerHTML = '<div class="text-muted text-center py-4">Waiting for comments stream to connect...</div>';
        
        // Setup Charts for simulator
        setupSimulatorCharts();
        
        // Fetch first batch immediately, then set interval
        fetchSimulatedComments(platform, query);
        
        state.simulation.intervalId = setInterval(() => {
            fetchSimulatedComments(platform, query);
        }, 4000);
    }

    function stopSimulator() {
        if (state.simulation.intervalId) {
            clearInterval(state.simulation.intervalId);
            state.simulation.intervalId = null;
        }
        state.simulation.isRunning = false;
        btnStartSim.style.display = 'inline-flex';
        btnStopSim.style.display = 'none';
        simIndicator.style.display = 'none';
    }

    async function fetchSimulatedComments(platform, query) {
        try {
            const response = await fetch(`/api/simulate/social?platform=${platform}&query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Simulator failed to fetch');
            
            const comments = await response.json();
            
            // Clear connecting message
            if (state.simulation.commentCount === 0 && comments.length > 0) {
                streamContainer.innerHTML = '';
            }
            
            comments.forEach(comment => {
                state.simulation.commentCount++;
                state.simulation.commentsList.push(comment);
                
                // Keep only last 50 in memory
                if (state.simulation.commentsList.length > 50) {
                    state.simulation.commentsList.shift();
                }

                // Update metrics totals
                const analysis = comment.analysis;
                state.simulation.sentimentTimeline.push(analysis.scores.compound);
                if (state.simulation.sentimentTimeline.length > 20) {
                    state.simulation.sentimentTimeline.shift();
                }
                
                for (const [emo, val] of Object.entries(analysis.emotions)) {
                    state.simulation.emotionTotals[emo] = (state.simulation.emotionTotals[emo] || 0) + val;
                }

                // Inject into UI
                addCommentToUI(comment);
            });
            
            // Update charts
            updateSimulatorCharts();
            
        } catch (error) {
            console.error('Simulator error:', error);
        }
    }

    function addCommentToUI(comment) {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const initials = comment.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        
        let platformIcon = '';
        if (comment.platform === 'twitter') {
            platformIcon = '<i class="fab fa-twitter platform-badge twitter"></i>';
        } else if (comment.platform === 'reddit') {
            platformIcon = '<i class="fab fa-reddit platform-badge reddit"></i>';
        } else if (comment.platform === 'youtube') {
            platformIcon = '<i class="fab fa-youtube platform-badge youtube"></i>';
        }

        const div = document.createElement('div');
        div.className = 'comment-card';
        div.innerHTML = `
            ${platformIcon}
            <div class="comment-avatar" style="background-color: ${randomColor}">
                ${initials}
            </div>
            <div class="comment-body">
                <div class="comment-header">
                    <div class="user-info">
                        <span class="display-name">${comment.name}</span>
                        <span class="username">${comment.username}</span>
                    </div>
                    <span class="timestamp">${comment.timestamp}</span>
                </div>
                <div class="comment-text">${comment.text}</div>
                <div class="comment-footer">
                    <span class="badge ${comment.analysis.sentiment}">${comment.analysis.sentiment}</span>
                    <span class="text-muted" style="font-size: 0.8rem">
                        Score: ${comment.analysis.scores.compound.toFixed(2)} | Subjectivity: ${comment.analysis.subjectivity.toFixed(2)}
                    </span>
                </div>
            </div>
        `;

        // Prepend to show latest at top
        streamContainer.insertBefore(div, streamContainer.firstChild);
        
        // Remove old cards visually to prevent browser bloat
        if (streamContainer.childNodes.length > 30) {
            streamContainer.removeChild(streamContainer.lastChild);
        }
    }

    function setupSimulatorCharts() {
        destroyChart('simTimeline');
        destroyChart('simEmotion');
        
        const colors = getChartColors();
        
        // Timeline chart
        const ctxTimeline = document.getElementById('simTimelineChart').getContext('2d');
        state.charts['simTimeline'] = new Chart(ctxTimeline, {
            type: 'line',
            data: {
                labels: Array(20).fill(''),
                datasets: [{
                    label: 'Sentiment Flow',
                    data: [],
                    borderColor: colors.secondary,
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        min: -1,
                        max: 1,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: { display: false }
                }
            }
        });

        // Accumulative Emotion chart
        const ctxEmotion = document.getElementById('simEmotionChart').getContext('2d');
        state.charts['simEmotion'] = new Chart(ctxEmotion, {
            type: 'bar',
            data: {
                labels: ['JOY', 'SADNESS', 'ANGER', 'FEAR', 'SURPRISE'],
                datasets: [{
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: [colors.joy, colors.sadness, colors.anger, colors.fear, colors.surprise],
                    borderColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' },
                        beginAtZero: true
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }

    function updateSimulatorCharts() {
        const simTimelineChart = state.charts['simTimeline'];
        const simEmotionChart = state.charts['simEmotion'];
        
        if (simTimelineChart) {
            // Update line chart data
            const dataLength = state.simulation.sentimentTimeline.length;
            simTimelineChart.data.labels = Array(dataLength).fill('');
            simTimelineChart.data.datasets[0].data = state.simulation.sentimentTimeline;
            simTimelineChart.update();
        }

        if (simEmotionChart) {
            // Update bar chart data
            const counts = [
                state.simulation.emotionTotals.joy || 0,
                state.simulation.emotionTotals.sadness || 0,
                state.simulation.emotionTotals.anger || 0,
                state.simulation.emotionTotals.fear || 0,
                state.simulation.emotionTotals.surprise || 0
            ];
            // Normalize values so they display well as counts
            simEmotionChart.data.datasets[0].data = counts.map(v => Math.round(v));
            simEmotionChart.update();
        }
    }

    // Initialize the landing page stats
    loadDashboardStats();
});
