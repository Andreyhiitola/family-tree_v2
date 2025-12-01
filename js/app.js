let familyData = [];
let currentEditId = null;
let photoDataUrls = [];
let currentPhotoIndex = 0;
let mediaRecorder = null;
let audioChunks = [];
let audioDataUrl = null;
let currentSpouses = []; // Массив супругов

// Загрузка данных из localStorage при старте
window.addEventListener('load', async () => {
    loadTheme();
    const saved = localStorage.getItem('familyTreeData');
    
    if (saved) {
        familyData = JSON.parse(saved);
    } else {
        // Если данных нет, попробовать загрузить демо-данные из файла
        try {
            const response = await fetch('data/default-data.json');
            if (response.ok) {
                const defaultData = await response.json();
                familyData = defaultData;
                // Не сохраняем автоматически, пользователь сам решит
            }
        } catch (error) {
            console.log('Демо-данные не загружены, начинаем с пустого древа');
            familyData = [];
        }
    }
    
    renderTree();
});

// Тема
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Сохранение данных
function saveData() {
    localStorage.setItem('familyTreeData', JSON.stringify(familyData));
    renderTree();
}

// Построение дерева
function buildTree(parentId = null) {
    const children = familyData.filter(person => {
        if (parentId === null) {
            // Корневые элементы - те, у кого нет родителей
            return !hasParent(person.id);
        }
        
        // Ребёнок если:
        // 1. Указан в children у родителя
        // 2. ИЛИ указан в children у супруга родителя
        const parent = familyData.find(p => p.id === parentId);
        if (!parent) return false;
        
        // Проверяем у самого родителя
        if (parent.children && parent.children.includes(person.id)) {
            return true;
        }
        
        // Проверяем у супругов родителя
        if (parent.spouses && parent.spouses.length > 0) {
            return parent.spouses.some(spouseId => {
                const spouse = familyData.find(p => p.id === spouseId);
                return spouse && spouse.children && spouse.children.includes(person.id);
            });
        }
        
        return false;
    });

    if (children.length === 0) return '';

    let html = '<ul>';
    children.forEach(person => {
        const dates = person.deathDate 
            ? `${person.birthDate?.split('-')[0] || '?'} - ${person.deathDate.split('-')[0]}`
            : person.birthDate ? `р. ${person.birthDate.split('-')[0]}` : '';

        const genderClass = person.gender ? person.gender : '';
        const photo = person.photos && person.photos.length > 0 ? person.photos[0] : '';
        
        // Отображение супругов
        let spouseInfo = '';
        if (person.spouses && person.spouses.length > 0) {
            const spouseNames = person.spouses
                .map(spouseId => {
                    const spouse = familyData.find(p => p.id === spouseId);
                    return spouse ? spouse.name : null;
                })
                .filter(name => name)
                .join(', ');
            
            if (spouseNames) {
                spouseInfo = `<div class="spouse-indicator">💍 ${spouseNames}</div>`;
            }
        }

        html += `
            <li>
                <div class="person-card ${genderClass}" data-id="${person.id}" onclick="showViewModal(${person.id})">
                    <button class="edit-btn" onclick="event.stopPropagation(); showEditModal(${person.id})">✏️</button>
                    ${photo ? 
                        `<img src="${photo}" alt="${person.name}" class="person-photo">` :
                        `<div class="person-photo">👤</div>`
                    }
                    <div class="person-name">${person.name}</div>
                    <div class="person-dates">${dates}</div>
                    ${spouseInfo}
                </div>
                ${buildTree(person.id)}
            </li>
        `;
    });
    html += '</ul>';
    return html;
}

// Проверка есть ли у человека родители
function hasParent(personId) {
    return familyData.some(p => p.children && p.children.includes(personId));
}

function renderTree() {
    const tree = document.getElementById('familyTree');
    if (familyData.length === 0) {
        tree.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🌱</div>
                <h3>Древо пока пусто</h3>
                <p>Нажмите "Добавить" чтобы начать</p>
            </div>
        `;
    } else {
        tree.innerHTML = buildTree();
    }
}

// Поиск
function searchPerson() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.person-card');
    const clearBtn = document.querySelector('.btn-clear');
    
    clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
    
    cards.forEach(card => {
        card.classList.remove('highlighted');
        if (query.length > 0) {
            const name = card.querySelector('.person-name').textContent.toLowerCase();
            if (name.includes(query)) {
                card.classList.add('highlighted');
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.querySelector('.btn-clear').style.display = 'none';
    document.querySelectorAll('.person-card').forEach(card => {
        card.classList.remove('highlighted');
    });
}

// Модальные окна
function showViewModal(personId) {
    const person = familyData.find(p => p.id === personId);
    if (!person) return;

    currentEditId = personId;
    currentPhotoIndex = 0;
    
    document.getElementById('viewModalName').textContent = person.name;
    
    const carousel = document.getElementById('photoCarousel');
    const photo = document.getElementById('viewModalPhoto');
    
    if (person.photos && person.photos.length > 0) {
        photo.src = person.photos[0];
        photo.style.display = 'block';
        carousel.querySelector('.prev').style.display = person.photos.length > 1 ? 'block' : 'none';
        carousel.querySelector('.next').style.display = person.photos.length > 1 ? 'block' : 'none';
    } else {
        photo.style.display = 'none';
        carousel.querySelector('.prev').style.display = 'none';
        carousel.querySelector('.next').style.display = 'none';
    }
    
    let infoHtml = '';
    if (person.gender) {
        infoHtml += `<p><strong>Пол:</strong> ${person.gender === 'male' ? 'Мужской' : 'Женский'}</p>`;
    }
    if (person.birthDate) {
        infoHtml += `<p><strong>Дата рождения:</strong> ${formatDate(person.birthDate)}</p>`;
    }
    if (person.birthPlace) {
        infoHtml += `<p><strong>Место рождения:</strong> ${person.birthPlace}</p>`;
    }
    if (person.deathDate) {
        infoHtml += `<p><strong>Дата смерти:</strong> ${formatDate(person.deathDate)}</p>`;
    }
    
    // Показываем родителей
    const parents = getParents(person.id);
    if (parents.length > 0) {
        const parentNames = parents.map(parentId => {
            const parent = familyData.find(p => p.id === parentId);
            return parent ? parent.name : null;
        }).filter(name => name).join(', ');
        
        if (parentNames) {
            infoHtml += `<p><strong>Родители:</strong> ${parentNames}</p>`;
        }
    }
    
    if (person.spouses && person.spouses.length > 0) {
        const spouseNames = person.spouses
            .map(spouseId => {
                const spouse = familyData.find(p => p.id === spouseId);
                return spouse ? spouse.name : null;
            })
            .filter(name => name)
            .join(', ');
        
        if (spouseNames) {
            infoHtml += `<p><strong>Супруги:</strong> ${spouseNames}</p>`;
        }
    }
    
    // Показываем детей (объединённые от обоих супругов)
    const allChildren = getAllChildren(person.id);
    if (allChildren.length > 0) {
        const childrenNames = allChildren.map(childId => {
            const child = familyData.find(p => p.id === childId);
            return child ? child.name : null;
        }).filter(name => name).join(', ');
        
        if (childrenNames) {
            infoHtml += `<p><strong>Дети:</strong> ${childrenNames}</p>`;
        }
    }
    
    if (person.bio) {
        infoHtml += `<p><strong>О персоне:</strong> ${person.bio}</p>`;
    }
    if (person.events) {
        infoHtml += `<p><strong>Важные события:</strong></p><ul style="margin-left: 20px;">`;
        person.events.split('\n').forEach(event => {
            if (event.trim()) infoHtml += `<li>${event}</li>`;
        });
        infoHtml += `</ul>`;
    }

    document.getElementById('viewModalInfo').innerHTML = infoHtml;
    
    // Медиа секция
    let mediaHtml = '';
    if (person.videoUrl) {
        const videoId = extractVideoId(person.videoUrl);
        if (videoId) {
            mediaHtml += `<div class="video-container"><iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
        }
    }
    if (person.audioUrl) {
        mediaHtml += `<div class="audio-container"><audio controls src="${person.audioUrl}"></audio></div>`;
    }
    document.getElementById('mediaSection').innerHTML = mediaHtml;
    
    document.getElementById('viewModal').style.display = 'flex';
}

// Получить всех детей (свои + от супругов)
function getAllChildren(personId) {
    const person = familyData.find(p => p.id === personId);
    if (!person) return [];
    
    const allChildren = new Set();
    
    // Свои дети
    if (person.children) {
        person.children.forEach(id => allChildren.add(id));
    }
    
    // Дети супругов
    if (person.spouses && person.spouses.length > 0) {
        person.spouses.forEach(spouseId => {
            const spouse = familyData.find(p => p.id === spouseId);
            if (spouse && spouse.children) {
                spouse.children.forEach(id => allChildren.add(id));
            }
        });
    }
    
    return Array.from(allChildren);
}

// Получить родителей человека
function getParents(personId) {
    const parents = [];
    familyData.forEach(person => {
        if (person.children && person.children.includes(personId)) {
            parents.push(person.id);
        }
    });
    return parents;
}

function prevPhoto() {
    const person = familyData.find(p => p.id === currentEditId);
    if (!person || !person.photos || person.photos.length <= 1) return;
    
    currentPhotoIndex = (currentPhotoIndex - 1 + person.photos.length) % person.photos.length;
    document.getElementById('viewModalPhoto').src = person.photos[currentPhotoIndex];
}

function nextPhoto() {
    const person = familyData.find(p => p.id === currentEditId);
    if (!person || !person.photos || person.photos.length <= 1) return;
    
    currentPhotoIndex = (currentPhotoIndex + 1) % person.photos.length;
    document.getElementById('viewModalPhoto').src = person.photos[currentPhotoIndex];
}

function extractVideoId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
}

function showAddPersonModal() {
    currentEditId = null;
    photoDataUrls = [];
    audioDataUrl = null;
    currentSpouses = [];
    document.getElementById('editModalTitle').textContent = 'Добавить человека';
    document.getElementById('personForm').reset();
    renderPhotosPreview();
    renderSpousesList();
    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('audioPreview').style.display = 'none';
    updateParentSelect('personParent1');
    updateParentSelect('personParent2');
    updateSpouseSelect();
    document.getElementById('editModal').style.display = 'flex';
}

function showEditModal(personId) {
    const person = familyData.find(p => p.id === personId);
    if (!person) return;

    currentEditId = personId;
    photoDataUrls = person.photos ? [...person.photos] : [];
    audioDataUrl = person.audioUrl || null;
    currentSpouses = person.spouses ? [...person.spouses] : [];
    
    document.getElementById('editModalTitle').textContent = 'Редактировать';
    document.getElementById('personName').value = person.name;
    document.getElementById('personBirthDate').value = person.birthDate || '';
    document.getElementById('personDeathDate').value = person.deathDate || '';
    document.getElementById('personBio').value = person.bio || '';
    document.getElementById('personGender').value = person.gender || '';
    document.getElementById('personBirthPlace').value = person.birthPlace || '';
    document.getElementById('personEvents').value = person.events || '';
    document.getElementById('personVideo').value = person.videoUrl || '';
    
    renderPhotosPreview();
    renderSpousesList();
    
    const audioPreview = document.getElementById('audioPreview');
    if (audioDataUrl) {
        audioPreview.src = audioDataUrl;
        audioPreview.style.display = 'block';
    } else {
        audioPreview.style.display = 'none';
    }
    
    updateParentSelect('personParent1', personId);
    updateParentSelect('personParent2', personId);
    updateSpouseSelect(personId);
    
    document.getElementById('deleteBtn').style.display = 'block';
    document.getElementById('editModal').style.display = 'flex';
}

function editCurrentPerson() {
    closeModal('viewModal');
    showEditModal(currentEditId);
}

function updateParentSelect(selectId, excludeId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    select.innerHTML = '<option value="">Нет родителя</option>';
    
    familyData.forEach(person => {
        if (person.id !== excludeId) {
            const option = document.createElement('option');
            option.value = person.id;
            option.textContent = person.name;
            
            if (excludeId) {
                // Проверяем является ли этот человек родителем
                const isParent = person.children && person.children.includes(excludeId);
                
                if (isParent) {
                    option.selected = true;
                }
            }
            
            select.appendChild(option);
        }
    });
}

function updateSpouseSelect(excludeId = null) {
    const select = document.getElementById('personSpouse');
    select.innerHTML = '<option value="">Выберите супруга...</option>';
    
    familyData.forEach(person => {
        // Исключаем текущего человека и уже добавленных супругов
        if (person.id !== excludeId && !currentSpouses.includes(person.id)) {
            const option = document.createElement('option');
            option.value = person.id;
            option.textContent = person.name;
            select.appendChild(option);
        }
    });
}

// Добавление супруга
function addSpouse() {
    const select = document.getElementById('personSpouse');
    const spouseId = parseInt(select.value);
    
    if (!spouseId) {
        alert('Выберите супруга из списка');
        return;
    }
    
    if (!currentSpouses.includes(spouseId)) {
        currentSpouses.push(spouseId);
        renderSpousesList();
        updateSpouseSelect(currentEditId);
        select.value = '';
    }
}

// Удаление супруга из списка
function removeSpouse(spouseId) {
    currentSpouses = currentSpouses.filter(id => id !== spouseId);
    renderSpousesList();
    updateSpouseSelect(currentEditId);
}

// Отображение списка супругов
function renderSpousesList() {
    const container = document.getElementById('spousesList');
    
    if (currentSpouses.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = currentSpouses.map(spouseId => {
        const spouse = familyData.find(p => p.id === spouseId);
        if (!spouse) return '';
        
        return `
            <div class="spouse-tag">
                <span>${spouse.name}</span>
                <button class="remove-spouse" onclick="removeSpouse(${spouseId})" type="button">✕</button>
            </div>
        `;
    }).join('');
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Обработка загрузки фото
document.getElementById('photoInput').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(event) {
            photoDataUrls.push(event.target.result);
            renderPhotosPreview();
        };
        reader.readAsDataURL(file);
    });
    
    e.target.value = '';
});

function renderPhotosPreview() {
    const container = document.getElementById('photosPreview');
    container.innerHTML = photoDataUrls.map((url, index) => `
        <div class="photo-item">
            <img src="${url}" alt="Photo ${index + 1}">
            <button class="remove-photo" onclick="removePhoto(${index})">✕</button>
        </div>
    `).join('') + `
        <div class="add-photo-btn" onclick="document.getElementById('photoInput').click()">
            <span>➕</span>
            <p>Добавить</p>
        </div>
    `;
}

function removePhoto(index) {
    photoDataUrls.splice(index, 1);
    renderPhotosPreview();
}

// Аудио запись
async function toggleRecording() {
    const btn = document.getElementById('recordBtn');
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        btn.textContent = '🎤 Записать';
        btn.classList.remove('recording');
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (e) => {
                audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = (e) => {
                    audioDataUrl = e.target.result;
                    const audioPreview = document.getElementById('audioPreview');
                    audioPreview.src = audioDataUrl;
                    audioPreview.style.display = 'block';
                };
                reader.readAsDataURL(audioBlob);
                
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            btn.textContent = '⏹️ Остановить';
            btn.classList.add('recording');
        } catch (err) {
            alert('Не удалось получить доступ к микрофону');
        }
    }
}

// Сохранение формы
document.getElementById('personForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('personName').value;
    const birthDate = document.getElementById('personBirthDate').value;
    const deathDate = document.getElementById('personDeathDate').value;
    const bio = document.getElementById('personBio').value;
    const gender = document.getElementById('personGender').value;
    const birthPlace = document.getElementById('personBirthPlace').value;
    const events = document.getElementById('personEvents').value;
    const videoUrl = document.getElementById('personVideo').value;
    const parent1Id = document.getElementById('personParent1').value;
    const parent2Id = document.getElementById('personParent2').value;

    if (currentEditId) {
        const person = familyData.find(p => p.id === currentEditId);
        if (person) {
            // Удаляем старые связи супругов
            if (person.spouses && person.spouses.length > 0) {
                person.spouses.forEach(oldSpouseId => {
                    const oldSpouse = familyData.find(p => p.id === oldSpouseId);
                    if (oldSpouse && oldSpouse.spouses) {
                        oldSpouse.spouses = oldSpouse.spouses.filter(id => id !== currentEditId);
                    }
                });
            }
            
            person.name = name;
            person.birthDate = birthDate;
            person.deathDate = deathDate;
            person.bio = bio;
            person.gender = gender;
            person.birthPlace = birthPlace;
            person.events = events;
            person.videoUrl = videoUrl;
            person.spouses = [...currentSpouses];
            person.photos = photoDataUrls;
            person.audioUrl = audioDataUrl;
            
            // Устанавливаем обратные связи для супругов
            currentSpouses.forEach(spouseId => {
                const spouse = familyData.find(p => p.id === spouseId);
                if (spouse) {
                    if (!spouse.spouses) spouse.spouses = [];
                    if (!spouse.spouses.includes(currentEditId)) {
                        spouse.spouses.push(currentEditId);
                    }
                }
            });
            
            // Удаляем из старых родителей
            familyData.forEach(p => {
                if (p.children) {
                    p.children = p.children.filter(id => id !== currentEditId);
                }
            });
            
            // Добавляем к новым родителям
            if (parent1Id) {
                const parent1 = familyData.find(p => p.id == parent1Id);
                if (parent1) {
                    if (!parent1.children) parent1.children = [];
                    if (!parent1.children.includes(currentEditId)) {
                        parent1.children.push(currentEditId);
                    }
                }
            }
            if (parent2Id && parent2Id !== parent1Id) {
                const parent2 = familyData.find(p => p.id == parent2Id);
                if (parent2) {
                    if (!parent2.children) parent2.children = [];
                    if (!parent2.children.includes(currentEditId)) {
                        parent2.children.push(currentEditId);
                    }
                }
            }
        }
    } else {
        const newId = Math.max(0, ...familyData.map(p => p.id)) + 1;
        const newPerson = {
            id: newId,
            name,
            photos: photoDataUrls,
            birthDate,
            deathDate,
            bio,
            gender,
            birthPlace,
            events,
            videoUrl,
            audioUrl: audioDataUrl,
            spouses: [...currentSpouses],
            children: []
        };
        
        familyData.push(newPerson);
        
        // Устанавливаем обратные связи для супругов
        currentSpouses.forEach(spouseId => {
            const spouse = familyData.find(p => p.id === spouseId);
            if (spouse) {
                if (!spouse.spouses) spouse.spouses = [];
                if (!spouse.spouses.includes(newId)) {
                    spouse.spouses.push(newId);
                }
            }
        });
        
        // Добавляем к родителям
        if (parent1Id) {
            const parent1 = familyData.find(p => p.id == parent1Id);
            if (parent1) {
                if (!parent1.children) parent1.children = [];
                parent1.children.push(newId);
            }
        }
        if (parent2Id && parent2Id !== parent1Id) {
            const parent2 = familyData.find(p => p.id == parent2Id);
            if (parent2) {
                if (!parent2.children) parent2.children = [];
                parent2.children.push(newId);
            }
        }
    }

    saveData();
    closeModal('editModal');
});

function deletePerson() {
    if (!currentEditId) return;
    
    if (confirm('Вы уверены, что хотите удалить этого человека?')) {
        const person = familyData.find(p => p.id === currentEditId);
        
        // Удаляем связи супругов
        if (person && person.spouses && person.spouses.length > 0) {
            person.spouses.forEach(spouseId => {
                const spouse = familyData.find(p => p.id === spouseId);
                if (spouse && spouse.spouses) {
                    spouse.spouses = spouse.spouses.filter(id => id !== currentEditId);
                }
            });
        }
        
        familyData.forEach(p => {
            if (p.children) {
                p.children = p.children.filter(id => id !== currentEditId);
            }
        });
        
        familyData = familyData.filter(p => p.id !== currentEditId);
        
        saveData();
        closeModal('editModal');
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
                  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year} г.`;
}

// Галерея
function showGallery() {
    const gallery = document.getElementById('galleryGrid');
    let allPhotos = [];
    
    familyData.forEach(person => {
        if (person.photos && person.photos.length > 0) {
            person.photos.forEach(photo => {
                allPhotos.push({ photo, person });
            });
        }
    });
    
    if (allPhotos.length === 0) {
        gallery.innerHTML = '<div class="empty-state"><p>Нет фотографий</p></div>';
    } else {
        gallery.innerHTML = allPhotos.map(item => `
            <div class="gallery-item" onclick="showViewModal(${item.person.id})">
                <img src="${item.photo}" alt="${item.person.name}">
                <div class="gallery-item-name">${item.person.name}</div>
            </div>
        `).join('');
    }
    
    document.getElementById('galleryModal').style.display = 'flex';
}

// Статистика
function showStats() {
    const stats = calculateStats();
    const content = document.getElementById('statsContent');
    
    content.innerHTML = `
        <div class="stat-item">
            <span class="stat-label">Всего человек</span>
            <span class="stat-value">${stats.totalPeople}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Поколений</span>
            <span class="stat-value">${stats.generations}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Мужчин</span>
            <span class="stat-value">${stats.males}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Женщин</span>
            <span class="stat-value">${stats.females}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Фотографий</span>
            <span class="stat-value">${stats.totalPhotos}</span>
        </div>
        <div class="stat-item">
            <span class="stat-label">Супружеских пар</span>
            <span class="stat-value">${stats.marriages}</span>
        </div>
        ${stats.oldestPerson ? `
        <div class="stat-item">
            <span class="stat-label">Самый старший</span>
            <span class="stat-value">${stats.oldestPerson.name} (${stats.oldestAge} лет)</span>
        </div>
        ` : ''}
    `;
    
    document.getElementById('statsModal').style.display = 'flex';
}

function calculateStats() {
    const stats = {
        totalPeople: familyData.length,
        generations: calculateGenerations(),
        males: familyData.filter(p => p.gender === 'male').length,
        females: familyData.filter(p => p.gender === 'female').length,
        totalPhotos: familyData.reduce((sum, p) => sum + (p.photos ? p.photos.length : 0), 0),
        marriages: 0,
        oldestPerson: null,
        oldestAge: 0
    };
    
    // Подсчёт браков (уникальных пар)
    const countedPairs = new Set();
    familyData.forEach(person => {
        if (person.spouses && person.spouses.length > 0) {
            person.spouses.forEach(spouseId => {
                const pairKey = [person.id, spouseId].sort().join('-');
                countedPairs.add(pairKey);
            });
        }
    });
    stats.marriages = countedPairs.size;
    
    familyData.forEach(person => {
        if (person.birthDate) {
            const endDate = person.deathDate ? new Date(person.deathDate) : new Date();
            const age = Math.floor((endDate - new Date(person.birthDate)) / (365.25 * 24 * 60 * 60 * 1000));
            if (age > stats.oldestAge) {
                stats.oldestAge = age;
                stats.oldestPerson = person;
            }
        }
    });
    
    return stats;
}

function calculateGenerations() {
    function getDepth(personId, depth = 1) {
        const person = familyData.find(p => p.id === personId);
        if (!person || !person.children || person.children.length === 0) {
            return depth;
        }
        return Math.max(...person.children.map(childId => getDepth(childId, depth + 1)));
    }
    
    const roots = familyData.filter(person => 
        !familyData.some(p => p.children && p.children.includes(person.id))
    );
    
    if (roots.length === 0) return 1;
    return Math.max(...roots.map(root => getDepth(root.id)));
}

// Временная шкала
function showTimeline() {
    const timeline = {};
    
    familyData.forEach(person => {
        if (person.birthDate) {
            const year = person.birthDate.split('-')[0];
            if (!timeline[year]) timeline[year] = [];
            timeline[year].push({ person: person.name, event: 'Родился(ась)' });
        }
        if (person.deathDate) {
            const year = person.deathDate.split('-')[0];
            if (!timeline[year]) timeline[year] = [];
            timeline[year].push({ person: person.name, event: 'Умер(ла)' });
        }
        if (person.events) {
            person.events.split('\n').forEach(event => {
                const match = event.match(/^(\d{4})\s*-\s*(.+)/);
                if (match) {
                    const [, year, description] = match;
                    if (!timeline[year]) timeline[year] = [];
                    timeline[year].push({ person: person.name, event: description });
                }
            });
        }
    });
    
    const sortedYears = Object.keys(timeline).sort((a, b) => b - a);
    
    const content = document.getElementById('timelineContent');
    if (sortedYears.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>Нет событий для отображения</p></div>';
    } else {
        content.innerHTML = sortedYears.map(year => `
            <div class="timeline-item">
                <div class="timeline-year">${year}</div>
                <div class="timeline-events">
                    ${timeline[year].map(item => `
                        <div class="timeline-event">
                            <div class="timeline-person">${item.person}</div>
                            <div class="timeline-description">${item.event}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
    
    document.getElementById('timelineModal').style.display = 'flex';
}

// Карта
let map = null;
let markers = [];

function showMap() {
    const places = {};
    
    familyData.forEach(person => {
        if (person.birthPlace) {
            if (!places[person.birthPlace]) {
                places[person.birthPlace] = [];
            }
            places[person.birthPlace].push(person);
        }
    });
    
    if (Object.keys(places).length === 0) {
        document.getElementById('mapContent').innerHTML = '<div class="empty-state"><p>Нет данных о местах рождения</p></div>';
        document.getElementById('listContent').innerHTML = '<div class="empty-state"><p>Нет данных о местах рождения</p></div>';
    } else {
        renderMapList(places);
        initMap(places);
    }
    
    document.getElementById('mapModal').style.display = 'flex';
}

function toggleMapView(view) {
    if (view === 'map') {
        document.getElementById('mapContent').style.display = 'block';
        document.getElementById('listContent').style.display = 'none';
        document.getElementById('showMapBtn').classList.add('active');
        document.getElementById('showListBtn').classList.remove('active');
        
        // Обновляем размер карты после показа
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    } else {
        document.getElementById('mapContent').style.display = 'none';
        document.getElementById('listContent').style.display = 'block';
        document.getElementById('showMapBtn').classList.remove('active');
        document.getElementById('showListBtn').classList.add('active');
    }
}

function renderMapList(places) {
    const container = document.getElementById('mapList');
    
    container.innerHTML = Object.entries(places).map(([place, people]) => {
        const peopleNames = people.map(p => p.name).join(', ');
        return `
            <div class="map-item" onclick="focusOnPlace('${place}')">
                <div>
                    <div class="map-place">📍 ${place}</div>
                    <div class="map-people">${peopleNames}</div>
                </div>
                <div class="stat-value">${people.length}</div>
            </div>
        `;
    }).join('');
}

async function initMap(places) {
    // Очищаем старую карту
    const mapContainer = document.getElementById('map');
    mapContainer.innerHTML = '';
    
    // Создаём новую карту
    map = L.map('map').setView([55.7558, 37.6173], 4); // Центр: Москва
    
    // Добавляем слой OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    
    // Очищаем старые маркеры
    markers = [];
    
    // Добавляем маркеры для каждого места
    for (const [place, people] of Object.entries(places)) {
        try {
            const coords = await geocodePlace(place);
            if (coords) {
                const peopleList = people.map(p => 
                    `<div class="popup-person">${p.name}${p.birthDate ? ` (${p.birthDate.split('-')[0]})` : ''}</div>`
                ).join('');
                
                const popupContent = `
                    <div class="popup-place">${place}</div>
                    <div class="popup-people">
                        <strong>Люди (${people.length}):</strong>
                        ${peopleList}
                    </div>
                `;
                
                const marker = L.marker([coords.lat, coords.lon])
                    .addTo(map)
                    .bindPopup(popupContent);
                
                markers.push({ place, marker });
            }
        } catch (error) {
            console.warn(`Не удалось найти координаты для: ${place}`);
        }
    }
    
    // Подгоняем карту под все маркеры
    if (markers.length > 0) {
        const group = L.featureGroup(markers.map(m => m.marker));
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Геокодирование через Nominatim (OpenStreetMap)
async function geocodePlace(place) {
    // Проверяем, может это уже координаты
    const coordMatch = place.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
        return {
            lat: parseFloat(coordMatch[1]),
            lon: parseFloat(coordMatch[2])
        };
    }
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&limit=1`,
            {
                headers: {
                    'User-Agent': 'FamilyTreeApp/1.0'
                }
            }
        );
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        }
        return null;
    } catch (error) {
        console.error('Ошибка геокодирования:', error);
        return null;
    }
}

function focusOnPlace(place) {
    const markerObj = markers.find(m => m.place === place);
    if (markerObj) {
        toggleMapView('map');
        setTimeout(() => {
            map.setView(markerObj.marker.getLatLng(), 10);
            markerObj.marker.openPopup();
        }, 200);
    }
}

// Экспорт в PDF
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Захватываем древо
    const treeElement = document.getElementById('familyTree');
    
    try {
        const canvas = await html2canvas(treeElement, {
            scale: 2,
            backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 190;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.text('Генеалогическое древо семьи', 105, 15, { align: 'center' });
        pdf.addImage(imgData, 'PNG', 10, 25, imgWidth, imgHeight);
        
        pdf.save('family-tree.pdf');
    } catch (err) {
        alert('Ошибка при создании PDF');
    }
}

// Экспорт в Excel
function exportToExcel() {
    const wb = XLSX.utils.book_new();
    
    const excelData = familyData.map(person => {
        const parents = getParents(person.id);
        const parent1 = parents[0] || '';
        const parent2 = parents[1] || '';
        const events = person.events ? person.events.replace(/\n/g, ';') : '';
        const spouses = person.spouses && person.spouses.length > 0 
            ? person.spouses.join(',') 
            : '';
        
        return {
            'ID': person.id,
            'Имя': person.name,
            'Пол (male/female)': person.gender || '',
            'Дата рождения (ГГГГ-ММ-ДД)': person.birthDate || '',
            'Дата смерти (ГГГГ-ММ-ДД)': person.deathDate || '',
            'Место рождения': person.birthPlace || '',
            'ID родителя 1': parent1,
            'ID родителя 2': parent2,
            'ID супругов (через запятую)': spouses,
            'Биография': person.bio || '',
            'События (разделить ;)': events
        };
    });
    
    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Настройка ширины колонок
    ws['!cols'] = [
        {wch: 5}, {wch: 20}, {wch: 18}, {wch: 25}, {wch: 25}, 
        {wch: 25}, {wch: 15}, {wch: 15}, {wch: 25}, {wch: 40}, {wch: 50}
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Семья');
    XLSX.writeFile(wb, 'family-tree.xlsx');
}

// Экспорт/Импорт данных
function exportData() {
    const dataStr = JSON.stringify(familyData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'family-tree-data.json';
    link.click();
    URL.revokeObjectURL(url);
}

function importData() {
    document.getElementById('importInput').click();
}

function importExcel() {
    document.getElementById('excelInput').click();
}

// Скачать шаблон Excel
function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    
    const templateData = [
        ['ID', 'Имя', 'Пол (male/female)', 'Дата рождения (ГГГГ-ММ-ДД)', 'Дата смерти (ГГГГ-ММ-ДД)', 'Место рождения', 'ID родителя 1', 'ID родителя 2', 'ID супругов (через запятую)', 'Биография', 'События (разделить ;)'],
        [1, 'Иван Петрович', 'male', '1920-05-15', '1995-12-03', 'Москва, Россия', '', '', '2', 'Ветеран войны', '1941 - Призван в армию;1945 - Вернулся с войны'],
        [2, 'Анна Сергеевна', 'female', '1925-08-20', '', 'Санкт-Петербург, Россия', '', '', '1', 'Врач', '1945 - Окончила мединститут'],
        [3, 'Мария Ивановна', 'female', '1950-03-10', '', 'Москва, Россия', 1, 2, '', 'Учительница', '1972 - Окончила пединститут']
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    // Настройка ширины колонок
    ws['!cols'] = [
        {wch: 5}, {wch: 20}, {wch: 18}, {wch: 25}, {wch: 25}, 
        {wch: 25}, {wch: 15}, {wch: 15}, {wch: 25}, {wch: 40}, {wch: 50}
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Семья');
    XLSX.writeFile(wb, 'family-tree-template.xlsx');
}

// Импорт из Excel
document.getElementById('excelInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            
            if (jsonData.length === 0) {
                alert('Таблица пустая!');
                return;
            }
            
            if (!confirm(`Найдено ${jsonData.length} записей. Заменить текущие данные?`)) {
                return;
            }
            
            // Преобразуем данные из Excel в формат приложения
            const newFamilyData = jsonData.map((row, index) => {
                const person = {
                    id: row['ID'] || (index + 1),
                    name: row['Имя'] || row['Name'] || 'Без имени',
                    gender: row['Пол (male/female)'] || row['Gender'] || '',
                    birthDate: row['Дата рождения (ГГГГ-ММ-ДД)'] || row['Birth Date'] || '',
                    deathDate: row['Дата смерти (ГГГГ-ММ-ДД)'] || row['Death Date'] || '',
                    birthPlace: row['Место рождения'] || row['Birth Place'] || '',
                    bio: row['Биография'] || row['Bio'] || '',
                    events: row['События (разделить ;)'] || row['Events'] || '',
                    photos: [],
                    children: [],
                    spouses: []
                };
                
                // Обработка событий
                if (person.events) {
                    person.events = person.events.replace(/;/g, '\n');
                }
                
                // Обработка дат из Excel (если формат date)
                if (typeof person.birthDate === 'number') {
                    person.birthDate = excelDateToJSDate(person.birthDate);
                }
                if (typeof person.deathDate === 'number') {
                    person.deathDate = excelDateToJSDate(person.deathDate);
                }
                
                return person;
            });
            
            // Второй проход: устанавливаем связи родитель-ребенок и супругов
            jsonData.forEach((row, index) => {
                const parent1Id = row['ID родителя 1'] || row['Parent 1 ID'] || row['ID родителя'] || row['Parent ID'];
                const parent2Id = row['ID родителя 2'] || row['Parent 2 ID'];
                const spousesStr = row['ID супругов (через запятую)'] || row['Spouse IDs'] || row['ID супруга'] || row['Spouse ID'] || '';
                
                // Добавляем к родителю 1
                if (parent1Id) {
                    const parent = newFamilyData.find(p => p.id == parent1Id);
                    if (parent) {
                        if (!parent.children) parent.children = [];
                        if (!parent.children.includes(newFamilyData[index].id)) {
                            parent.children.push(newFamilyData[index].id);
                        }
                    }
                }
                
                // Добавляем к родителю 2
                if (parent2Id && parent2Id !== parent1Id) {
                    const parent = newFamilyData.find(p => p.id == parent2Id);
                    if (parent) {
                        if (!parent.children) parent.children = [];
                        if (!parent.children.includes(newFamilyData[index].id)) {
                            parent.children.push(newFamilyData[index].id);
                        }
                    }
                }
                
                // Обработка супругов (может быть несколько через запятую)
                if (spousesStr) {
                    const spouseIds = spousesStr.toString().split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                    newFamilyData[index].spouses = spouseIds;
                }
            });
            
            familyData = newFamilyData;
            saveData();
            alert('✅ Данные успешно импортированы!');
            
        } catch (err) {
            console.error(err);
            alert('Ошибка при чтении Excel файла: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
});

// Конвертация даты Excel в формат YYYY-MM-DD
function excelDateToJSDate(serial) {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    
    const year = date_info.getFullYear();
    const month = String(date_info.getMonth() + 1).padStart(2, '0');
    const day = String(date_info.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

document.getElementById('importInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const imported = JSON.parse(event.target.result);
                if (confirm('Импорт заменит текущие данные. Продолжить?')) {
                    familyData = imported;
                    saveData();
                }
            } catch (err) {
                alert('Ошибка при чтении файла');
            }
        };
        reader.readAsText(file);
    }
});

// Закрытие модального окна
window.onclick = function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
};
