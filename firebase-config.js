// Firebase Configuration
// Replace with your Firebase project credentials
const firebaseConfig = {
    apiKey: "AIzaSyB1780923456789012345678901234567",
    authDomain: "portfolio-contact-d37a6.firebaseapp.com",
    projectId: "portfolio-contact-d37a6",
    storageBucket: "portfolio-contact-d37a6.firebasestorage.app",
    messagingSenderId: "947065338820",
    appId: "1:947065338820:web:dc0aca77230fde21608291"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Contact form submission handler
class ContactFormHandler {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.submitText = document.getElementById('submitText');
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.messageContainer = document.getElementById('message-container');
        this.charCount = document.getElementById('char-count');
        this.messageInput = document.getElementById('message');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupCharacterCounter();
    }

    setupEventListeners() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
            
            // Real-time validation
            this.form.addEventListener('input', (e) => {
                this.validateField(e.target);
            });
            
            this.form.addEventListener('blur', (e) => {
                this.validateField(e.target, true);
            }, true);
        }
    }

    setupCharacterCounter() {
        if (this.messageInput && this.charCount) {
            this.messageInput.addEventListener('input', (e) => {
                const length = e.target.value.length;
                this.charCount.textContent = length;
                
                if (length > 900) {
                    this.charCount.style.color = '#dc2626';
                } else if (length > 800) {
                    this.charCount.style.color = '#f59e0b';
                } else {
                    this.charCount.style.color = 'inherit';
                }
            });
        }
    }

    validateField(field, showError = false) {
        const errorId = `${field.id}-error`;
        const errorElement = document.getElementById(errorId);
        
        if (!errorElement) return;

        let isValid = true;
        let message = '';

        // Clear previous error styling
        field.classList.remove('error-border');
        errorElement.textContent = '';

        // Required field validation
        if (field.hasAttribute('required') && !field.value.trim()) {
            if (showError) {
                isValid = false;
                message = 'This field is required';
            }
        }

        // Email validation
        if (field.type === 'email' && field.value.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) {
                isValid = false;
                message = 'Please enter a valid email address';
            }
        }

        // Phone validation (if provided)
        if (field.type === 'tel' && field.value.trim()) {
            const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
            const digitsOnly = field.value.replace(/\D/g, '');
            if (digitsOnly.length < 10) {
                isValid = false;
                message = 'Please enter a valid phone number';
            }
        }

        // Min length validation
        if (field.hasAttribute('minlength') && field.value.trim()) {
            const minLength = parseInt(field.getAttribute('minlength'));
            if (field.value.length < minLength) {
                isValid = false;
                message = `Minimum ${minLength} characters required`;
            }
        }

        // Max length validation
        if (field.hasAttribute('maxlength') && field.value.trim()) {
            const maxLength = parseInt(field.getAttribute('maxlength'));
            if (field.value.length > maxLength) {
                isValid = false;
                message = `Maximum ${maxLength} characters allowed`;
            }
        }

        if (!isValid && showError) {
            field.classList.add('error-border');
            errorElement.textContent = message;
        }

        return isValid;
    }

    validateForm() {
        let isValid = true;
        const fields = this.form.querySelectorAll('input, textarea, select');
        
        fields.forEach(field => {
            const fieldIsValid = this.validateField(field, true);
            if (!fieldIsValid) {
                isValid = false;
            }
        });

        return isValid;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            this.showMessage('Please fix the errors in the form.', 'error');
            return;
        }

        // Show loading state
        this.setLoading(true);

        try {
            // Get form data
            const formData = new FormData(this.form);
            const contactData = {
                name: formData.get('name').trim(),
                email: formData.get('email').trim(),
                phone: formData.get('phone')?.trim() || '',
                subject: formData.get('subject'),
                message: formData.get('message').trim(),
                newsletter: formData.get('newsletter') === 'on',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'unread',
                ip: await this.getClientIP()
            };

            // Save to Firestore
            await db.collection('contacts').add(contactData);

            // Show success message
            this.showMessage('Thank you! Your message has been sent successfully.', 'success');
            
            // Reset form
            this.form.reset();
            this.charCount.textContent = '0';
            
            // Send email notification (optional)
            await this.sendNotificationEmail(contactData);

        } catch (error) {
            console.error('Error submitting form:', error);
            this.showMessage('Something went wrong. Please try again later.', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.submitBtn.disabled = true;
            this.submitText.style.display = 'none';
            this.loadingSpinner.style.display = 'inline-block';
        } else {
            this.submitBtn.disabled = false;
            this.submitText.style.display = 'inline';
            this.loadingSpinner.style.display = 'none';
        }
    }

    showMessage(text, type) {
        // Clear previous messages
        this.messageContainer.innerHTML = '';
        
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = text;
        
        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.className = 'message-close';
        closeBtn.onclick = () => messageDiv.remove();
        messageDiv.appendChild(closeBtn);
        
        // Add to container
        this.messageContainer.appendChild(messageDiv);
        
        // Auto-remove after 5 seconds
        if (type === 'success') {
            setTimeout(() => messageDiv.remove(), 5000);
        }
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('Error fetching IP:', error);
            return 'unknown';
        }
    }

    async sendNotificationEmail(contactData) {
        // This is a placeholder for email sending functionality
        // In production, you would use:
        // 1. Firebase Cloud Functions with SendGrid/Mailgun
        // 2. EmailJS service
        // 3. Custom backend with nodemailer
        
        console.log('Email notification would be sent:', contactData);
        
        // Example using EmailJS (you need to sign up at https://www.emailjs.com/)
        /*
        if (typeof emailjs !== 'undefined') {
            emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', {
                to_name: 'You',
                from_name: contactData.name,
                message: contactData.message,
                reply_to: contactData.email
            });
        }
        */
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const contactFormHandler = new ContactFormHandler();
});