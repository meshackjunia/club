class MessagesAdmin {
    constructor() {
        this.messages = [];
        this.filteredMessages = [];
        this.currentMessage = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadMessages();
        this.setupRealTimeUpdates();
    }

    setupEventListeners() {
        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterMessages(e.target.value);
        });

        // Filter functionality
        document.getElementById('statusFilter').addEventListener('change', () => {
            this.filterMessages();
        });

        document.getElementById('sortFilter').addEventListener('change', () => {
            this.sortMessages();
            this.renderMessages();
        });

        // Export functionality
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportMessages();
        });

        // Modal close
        document.querySelector('.close-modal').addEventListener('click', () => {
            this.closeModal();
        });

        // Modal background close
        document.getElementById('messageModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });

        // Message actions
        document.getElementById('markAsReadBtn').addEventListener('click', () => {
            this.markAsRead();
        });

        document.getElementById('deleteBtn').addEventListener('click', () => {
            this.deleteMessage();
        });

        document.getElementById('replyBtn').addEventListener('click', () => {
            this.replyToMessage();
        });
    }

    async loadMessages() {
        try {
            const snapshot = await db.collection('contacts')
                .orderBy('timestamp', 'desc')
                .get();
            
            this.messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            }));

            this.filterMessages();
            this.updateCounters();
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            document.getElementById('loading').style.display = 'none';
        }
    }

    setupRealTimeUpdates() {
        db.collection('contacts')
            .orderBy('timestamp', 'desc')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const message = {
                            id: change.doc.id,
                            ...change.doc.data(),
                            timestamp: change.doc.data().timestamp?.toDate() || new Date()
                        };
                        
                        // Add to messages array if not already present
                        if (!this.messages.find(m => m.id === message.id)) {
                            this.messages.unshift(message);
                            this.filterMessages();
                            this.updateCounters();
                            
                            // Show notification for new message
                            if (change.doc.data().status === 'unread') {
                                this.showNotification(message);
                            }
                        }
                    }
                    
                    if (change.type === 'modified') {
                        const index = this.messages.findIndex(m => m.id === change.doc.id);
                        if (index !== -1) {
                            this.messages[index] = {
                                id: change.doc.id,
                                ...change.doc.data(),
                                timestamp: change.doc.data().timestamp?.toDate() || new Date()
                            };
                            this.filterMessages();
                            this.updateCounters();
                        }
                    }
                    
                    if (change.type === 'removed') {
                        this.messages = this.messages.filter(m => m.id !== change.doc.id);
                        this.filterMessages();
                        this.updateCounters();
                    }
                });
            });
    }

    filterMessages(searchTerm = '') {
        const statusFilter = document.getElementById('statusFilter').value;
        
        this.filteredMessages = this.messages.filter(message => {
            // Status filter
            if (statusFilter !== 'all' && message.status !== statusFilter) {
                return false;
            }
            
            // Search filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return (
                    message.name.toLowerCase().includes(searchLower) ||
                    message.email.toLowerCase().includes(searchLower) ||
                    message.message.toLowerCase().includes(searchLower) ||
                    message.subject.toLowerCase().includes(searchLower)
                );
            }
            
            return true;
        });

        this.sortMessages();
        this.renderMessages();
    }

    sortMessages() {
        const sortBy = document.getElementById('sortFilter').value;
        
        this.filteredMessages.sort((a, b) => {
            if (sortBy === 'newest') {
                return b.timestamp - a.timestamp;
            } else {
                return a.timestamp - b.timestamp;
            }
        });
    }

    renderMessages() {
        const messagesList = document.getElementById('messagesList');
        const noMessages = document.getElementById('noMessages');
        
        if (this.filteredMessages.length === 0) {
            messagesList.style.display = 'none';
            noMessages.style.display = 'flex';
            return;
        }

        messagesList.style.display = 'block';
        noMessages.style.display = 'none';
        
        messagesList.innerHTML = this.filteredMessages.map(message => `
            <div class="message-card ${message.status === 'unread' ? 'unread' : ''}" 
                 data-id="${message.id}" 
                 onclick="messagesAdmin.viewMessage('${message.id}')">
                <div class="message-info">
                    <div class="message-header">
                        <span class="message-name">${this.escapeHtml(message.name)}</span>
                        <span class="message-subject">${this.getSubjectLabel(message.subject)}</span>
                    </div>
                    <div class="message-preview">
                        ${this.escapeHtml(message.message.substring(0, 100))}${message.message.length > 100 ? '...' : ''}
                    </div>
                    <div class="message-meta">
                        <span><i class="fas fa-envelope"></i> ${this.escapeHtml(message.email)}</span>
                        ${message.phone ? `<span><i class="fas fa-phone"></i> ${this.escapeHtml(message.phone)}</span>` : ''}
                        <span><i class="fas fa-clock"></i> ${this.formatDate(message.timestamp)}</span>
                    </div>
                </div>
                <div class="message-status">
                    <span class="status-badge ${message.status}">${message.status}</span>
                    <span class="message-time">${this.formatTimeAgo(message.timestamp)}</span>
                </div>
            </div>
        `).join('');
    }

    viewMessage(messageId) {
        this.currentMessage = this.messages.find(m => m.id === messageId);
        
        if (!this.currentMessage) return;
        
        // Update modal content
        document.getElementById('modalSubject').textContent = this.getSubjectLabel(this.currentMessage.subject);
        document.getElementById('modalName').textContent = this.currentMessage.name;
        document.getElementById('modalEmail').textContent = this.currentMessage.email;
        document.getElementById('modalPhone').textContent = this.currentMessage.phone || 'Not provided';
        document.getElementById('modalTime').textContent = this.formatDate(this.currentMessage.timestamp, true);
        document.getElementById('modalMessage').textContent = this.currentMessage.message;
        
        // Mark as read if unread
        if (this.currentMessage.status === 'unread') {
            this.updateMessageStatus(messageId, 'read');
        }
        
        // Show modal
        document.getElementById('messageModal').classList.add('active');
    }

    closeModal() {
        document.getElementById('messageModal').classList.remove('active');
        this.currentMessage = null;
    }

    async markAsRead() {
        if (!this.currentMessage) return;
        
        const newStatus = this.currentMessage.status === 'unread' ? 'read' : 'unread';
        await this.updateMessageStatus(this.currentMessage.id, newStatus);
        this.closeModal();
    }

    async deleteMessage() {
        if (!this.currentMessage) return;
        
        if (confirm('Are you sure you want to delete this message?')) {
            try {
                await db.collection('contacts').doc(this.currentMessage.id).delete();
                this.closeModal();
            } catch (error) {
                console.error('Error deleting message:', error);
                alert('Error deleting message. Please try again.');
            }
        }
    }

    replyToMessage() {
        if (!this.currentMessage) return;
        
        const subject = `Re: ${this.getSubjectLabel(this.currentMessage.subject)}`;
        const body = `\n\n--- Original Message ---\nFrom: ${this.currentMessage.name}\nDate: ${this.formatDate(this.currentMessage.timestamp, true)}\n\n${this.currentMessage.message}`;
        
        window.location.href = `mailto:${this.currentMessage.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        // Mark as replied
        this.updateMessageStatus(this.currentMessage.id, 'replied');
    }

    async updateMessageStatus(messageId, status) {
        try {
            await db.collection('contacts').doc(messageId).update({
                status: status
            });
        } catch (error) {
            console.error('Error updating message status:', error);
        }
    }

    updateCounters() {
        const total = this.messages.length;
        const unread = this.messages.filter(m => m.status === 'unread').length;
        
        document.getElementById('total-count').textContent = `${total} total`;
        document.getElementById('unread-count').textContent = `${unread} unread`;
    }

    exportMessages() {
        const exportData = this.filteredMessages.map(msg => ({
            Name: msg.name,
            Email: msg.email,
            Phone: msg.phone || '',
            Subject: this.getSubjectLabel(msg.subject),
            Message: msg.message,
            Status: msg.status,
            Date: this.formatDate(msg.timestamp, true),
            'Newsletter Opt-in': msg.newsletter ? 'Yes' : 'No'
        }));

        const csv = this.convertToCSV(exportData);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `messages_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    convertToCSV(data) {
        const headers = Object.keys(data[0] || {});
        const rows = data.map(row => 
            headers.map(header => 
                `"${String(row[header] || '').replace(/"/g, '""')}"`
            ).join(',')
        );
        return [headers.join(','), ...rows].join('\n');
    }

    showNotification(message) {
        // Check if browser supports notifications
        if (!("Notification" in window)) return;

        // Request permission if needed
        if (Notification.permission === "default") {
            Notification.requestPermission();
        }

        // Show notification if permission granted
        if (Notification.permission === "granted") {
            new Notification("New Message Received", {
                body: `${message.name}: ${message.message.substring(0, 100)}...`,
                icon: '/assets/icons/notification-icon.png'
            });
        }
    }

    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getSubjectLabel(subject) {
        const subjects = {
            'project': 'Project Inquiry',
            'job': 'Job Opportunity',
            'collaboration': 'Collaboration',
            'other': 'Other'
        };
        return subjects[subject] || subject;
    }

    formatDate(date, full = false) {
        if (!date) return 'Unknown';
        
        const d = new Date(date);
        if (full) {
            return d.toLocaleString();
        }
        return d.toLocaleDateString();
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return this.formatDate(date);
    }
}

// Initialize admin panel
let messagesAdmin;
document.addEventListener('DOMContentLoaded', () => {
    messagesAdmin = new MessagesAdmin();
    window.messagesAdmin = messagesAdmin; // Make available globally for onclick events
});