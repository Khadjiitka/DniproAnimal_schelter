document.addEventListener("DOMContentLoaded", () => {
    const title = document.getElementById("title");
    const layers = document.querySelectorAll(".layer");

    setTimeout(() => {
        if (title) title.classList.add("show");
    }, 300);

    window.addEventListener("scroll", () => {
        const scrollY = window.scrollY;
        if (window.innerWidth > 768) {
            layers.forEach(layer => {
                const speed = layer.getAttribute("data-speed");
                layer.style.transform = `translateY(${scrollY * speed}px)`;
            });
            if (title) {
                title.style.transform = `translate(-50%, calc(-50% + ${scrollY * 0.1}px))`;
                title.style.opacity = 1 - (scrollY / 700);
            }
        }
    });

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add("active");
            else entry.target.classList.remove("active");
        });
    }, { threshold: 0.15 });
    document.querySelectorAll(".reveal").forEach(el => revealObserver.observe(el));

    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const numbers = entry.target.querySelectorAll('.stat-number');
            if (entry.isIntersecting) {
                numbers.forEach(num => {
                    const target = +num.getAttribute('data-target');
                    let count = 0;
                    const increment = Math.ceil(target / 50);
                    const tick = () => {
                        count = Math.min(count + increment, target);
                        num.innerText = count;
                        if (count < target) setTimeout(tick, 30);
                    };
                    tick();
                });
            } else {
                numbers.forEach(num => num.innerText = "0");
            }
        });
    }, { threshold: 0.4 });
    document.querySelectorAll('.stats-section').forEach(s => statsObserver.observe(s));

    const petModal = document.getElementById('petModal');
    const petInfoPage = document.getElementById('modalInfoPage');
    const petFormPage = document.getElementById('adoptionFormContainer');
    const showPetFormBtn = document.getElementById('showFormBtn');
    const backToPetInfoBtn = document.getElementById('backToInfo');
    const closePetModalBtn = petModal ? petModal.querySelector('.close-modal') : null;

    if (showPetFormBtn) {
        showPetFormBtn.addEventListener('click', () => {
            petInfoPage.style.display = 'none';
            petFormPage.style.display = 'block';
        });
    }
    if (backToPetInfoBtn) {
        backToPetInfoBtn.addEventListener('click', () => {
            petFormPage.style.display = 'none';
            petInfoPage.style.display = 'flex';
        });
    }
    if (closePetModalBtn) {
        closePetModalBtn.onclick = () => {
            petModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        };
    }

    const adoptionForm = document.getElementById('adoptionForm');
    if (adoptionForm) {
        adoptionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = adoptionForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Надсилаємо...';

            const formData = new FormData(adoptionForm);
            const payload = {
                pet_id: document.getElementById('adoptionPetId')?.value || null,
                pet_name: document.getElementById('adoptionPetName')?.textContent || null,
                applicant_name: formData.get('applicant_name'),
                phone: formData.get('phone'),
                email: formData.get('email'),
                message: formData.get('message')
            };

            try {
                const res = await fetch('/api/adoptions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    adoptionForm.style.display = 'none';
                    document.getElementById('adoptionSuccess').style.display = 'block';
                } else {
                    throw new Error('Server error');
                }
            } catch {
                btn.disabled = false;
                btn.textContent = 'Надіслати заявку 🐾';
                alert('Сервер недоступний. Будь ласка, заповніть форму за посиланням або зверніться до нас напряму.');
            }
        });
    }

    loadPets();

    initChat();
});


async function loadPets() {
    let pets = [];
    try {
        const res = await fetch('/api/pets', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            const data = await res.json();
            pets = data.pets;
        }
    } catch {
        try {
            const res = await fetch('/pets.json');
            if (res.ok) {
                const data = await res.json();
                pets = data.pets || [];
            }
        } catch (e) {
            console.warn('Could not load pets:', e);
        }
    }
    renderPets(pets);
}

function renderPets(pets) {
    const cats = pets.filter(p => p.type === 'cat');
    const dogs = pets.filter(p => p.type === 'dog');
    renderPetGrid(document.getElementById('cats-grid'), cats);
    renderPetGrid(document.getElementById('dogs-grid'), dogs);
    attachPetCardHandlers();
}

function renderPetGrid(container, pets) {
    if (!container) return;
    if (!pets.length) {
        container.innerHTML = '<p class="no-pets">Наразі немає доступних тварин у цій категорії.</p>';
        return;
    }
    container.innerHTML = pets.map(pet => {
        const statusBadge = pet.status !== 'Шукає родину'
            ? `<div class="pet-status-badge">${esc(pet.status)}</div>` : '';
        return `
        <a href="#" class="pet-card"
            data-id="${esc(pet.id)}"
            data-name="${esc(pet.name)}"
            data-gender="${esc(pet.gender || '—')}"
            data-age="${esc(pet.age || '—')}"
            data-vax="${esc(pet.vaccinated || '—')}"
            data-temper="${esc(pet.status || '—')}"
            data-desc="${esc(pet.description || '')}">
            <img src="${esc(pet.photo || 'img/pet1.jpeg')}" alt="${esc(pet.name)}" class="pet-image"
                 onerror="this.src='img/pet1.jpeg'">
            <div class="pet-info-overlay">
                <h3 class="pet-name">${esc(pet.name)}</h3>
            </div>
            ${statusBadge}
        </a>`;
    }).join('');
}

function attachPetCardHandlers() {
    const petModal = document.getElementById('petModal');
    const petInfoPage = document.getElementById('modalInfoPage');
    const petFormPage = document.getElementById('adoptionFormContainer');

    document.querySelectorAll('.pet-card').forEach(card => {
        card.addEventListener('click', function (e) {
            if (this.closest('#about-us')) return;
            e.preventDefault();

            petInfoPage.style.display = 'flex';
            petFormPage.style.display = 'none';

            const form = document.getElementById('adoptionForm');
            if (form) {
                form.reset();
                form.style.display = '';
            }
            const successMsg = document.getElementById('adoptionSuccess');
            if (successMsg) successMsg.style.display = 'none';
            const btn = form?.querySelector('button[type="submit"]');
            if (btn) { btn.disabled = false; btn.textContent = 'Надіслати заявку 🐾'; }

            const img = this.querySelector('img');
            if (img) document.getElementById('modalImg').src = img.src;

            const name = this.dataset.name || 'Пухнастик';
            document.getElementById('modalName').innerText = name;
            document.getElementById('modalGender').innerText = this.dataset.gender || '—';
            document.getElementById('modalAge').innerText = this.dataset.age || '—';
            document.getElementById('modalVax').innerText = this.dataset.vax || '—';
            document.getElementById('modalTemper').innerText = this.dataset.temper || '—';
            document.getElementById('modalDesc').innerText = this.dataset.desc || '';

            const petIdInput = document.getElementById('adoptionPetId');
            if (petIdInput) petIdInput.value = this.dataset.id || '';
            const petNameSpan = document.getElementById('adoptionPetName');
            if (petNameSpan) petNameSpan.textContent = name;

            petModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });
    });
}


const chatHistory = [];

function initChat() {
    const sendBtn = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    if (!sendBtn || !input) return;

    sendBtn.addEventListener('click', sendChatMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    appendChatMessage('user', text);
    chatHistory.push({ role: 'user', content: text });

    const typingId = appendTypingIndicator();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: chatHistory })
        });

        removeTypingIndicator(typingId);

        if (res.ok) {
            const data = await res.json();
            const reply = data.reply || 'Вибачте, не вдалося отримати відповідь.';
            appendChatMessage('bot', reply);
            chatHistory.push({ role: 'assistant', content: reply });
        } else {
            appendChatMessage('bot', 'Вибачте, сталася помилка. Спробуйте ще раз або зверніться до нас: dniproanimals@ukr.net');
        }
    } catch {
        removeTypingIndicator(typingId);
        appendChatMessage('bot', 'Зараз AI-консультант недоступний. Зв\'яжіться з нами напряму: +380 (99) 000-00-00');
    }
}

function appendChatMessage(role, text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `chat-message ${role}`;
    div.innerHTML = `<div class="chat-bubble">${escHtml(text)}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendTypingIndicator() {
    const container = document.getElementById('chat-messages');
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.className = 'chat-message bot typing';
    div.id = id;
    div.innerHTML = '<div class="chat-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    document.getElementById(id)?.remove();
}


function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.body.style.overflow = 'auto';
}

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeAllModals();
});

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => alert('Реквізити скопійовано!'));
}


function esc(val) {
    return String(val ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}
