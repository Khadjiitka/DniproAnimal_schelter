document.addEventListener("DOMContentLoaded", () => {
    const title = document.getElementById("title");
    const layers = document.querySelectorAll(".layer");
    
    const petModal = document.getElementById('petModal');
    const petInfoPage = document.getElementById('modalInfoPage');
    const petFormPage = document.getElementById('adoptionFormContainer');
    const showPetFormBtn = document.getElementById('showFormBtn');
    const backToPetInfoBtn = document.getElementById('backToInfo');
    const closePetModalBtn = petModal ? petModal.querySelector('.close-modal') : null;

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
            if (entry.isIntersecting) {
                entry.target.classList.add("active");
            } else {
                entry.target.classList.remove("active");
            }
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
                    const speed = 30; 
                    
                    const updateCount = () => {
                        if (count < target) {
                            count += increment;
                            if (count > target) count = target;
                            num.innerText = count;
                            setTimeout(updateCount, speed);
                        } else {
                            num.innerText = target;
                        }
                    };
                    updateCount();
                });
            } else {
                numbers.forEach(num => num.innerText = "0");
            }
        });
    }, { threshold: 0.4 }); 

    document.querySelectorAll('.stats-section').forEach(section => statsObserver.observe(section));

    document.querySelectorAll('.pet-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (this.closest('#about-us')) return;
            
            e.preventDefault();
            if (petInfoPage && petFormPage) {
                petInfoPage.style.display = 'flex';
                petFormPage.style.display = 'none';
            }
            const img = this.querySelector('img');
            if (img) document.getElementById('modalImg').src = img.src;
            
            document.getElementById('modalName').innerText = this.dataset.name || "Пухнастик";
            document.getElementById('modalGender').innerText = this.dataset.gender || "---";
            document.getElementById('modalAge').innerText = this.dataset.age || "---";
            document.getElementById('modalVax').innerText = this.dataset.vax || "---";
            document.getElementById('modalTemper').innerText = this.dataset.temper || "---";
            document.getElementById('modalDesc').innerText = this.dataset.desc || "";

            petModal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; 
        });
    });

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
});

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
    if (e.target.classList.contains('modal')) {
        closeAllModals();
    }
});

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("Реквізити скопійовано!");
    });
}