// app.js - Modular SDK - WITH BAR DEBUGGING LOGS

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, getDocs, limit as firestoreLimit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    const firebaseConfig = { // YOUR ACTUAL FIREBASE CONFIG HERE
        apiKey: "AIzaSyBO1J6r9UZlBnxqsRoIifzxAZjIXmYMNek",
        authDomain: "sms-voting-system-3c227.firebaseapp.com",
        projectId: "sms-voting-system-3c227",
        storageBucket: "sms-voting-system-3c227.firebasestorage.app",
        messagingSenderId: "861209613847",
        appId: "1:861209613847:web:185f5243beb1f3f313ee52",
        measurementId: "G-RSC18YSS3V"
    };

    try {
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        console.log("Firebase initialized successfully!");

        const contestantsArea = document.getElementById('contestants-area');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const nav = document.querySelector('.main-nav');
        const navLoaderContainer = document.querySelector('.nav-loader'); // Get the parent for opacity
        const navLoaderBar = document.querySelector('.nav-loader-bar'); // For width animation
        const botswanaFactDisplay = document.getElementById('botswana-fact-display');

        if (!contestantsArea || !loadingSpinner || !nav || !botswanaFactDisplay) { // Removed navLoader checks as it's gone
            console.error("CRITICAL: Essential HTML elements 'contestants-area', 'loadingSpinner', 'main-nav', or 'botswana-fact-display' not found!");
            if(loadingSpinner) loadingSpinner.innerHTML = "Page structure error.";
            return;
        }
        // Check for navLoaderBar only if it's intended to be there
        if (document.querySelector('.nav-loader-bar') && !navLoaderBar) { // If the element exists in HTML but not found by querySelector
             console.warn("Warning: .nav-loader-bar element exists in HTML but was not found by querySelector. Check class names/IDs.");
        }


        console.log("Required HTML elements found (or gracefully handled if optional).");

        // Nav bar effects
        let navScrolled = false;
        window.addEventListener('scroll', () => {
            if (window.scrollY > 30 && !navScrolled) {
                nav.classList.add('scrolled');
                navScrolled = true;
            } else if (window.scrollY <= 30 && navScrolled) {
                nav.classList.remove('scrolled');
                navScrolled = false;
            }
        });
        
        // Nav loader logic - only if navLoaderBar and navLoaderContainer are present
        let firstLoad = true; 
        if (navLoaderBar && navLoaderContainer) {
            navLoaderBar.style.width = '0%'; 
            navLoaderContainer.style.opacity = '1'; 
            setTimeout(() => {
                navLoaderBar.style.width = '70%'; 
            }, 100);
        } else {
            // If nav loader elements are intentionally removed, set firstLoad to false
            // so the onSnapshot logic doesn't try to interact with them.
            firstLoad = false; 
            console.log("Nav loader elements not found, skipping nav loader animation.");
        }


        const VOTE_BAR_TARGET = 700;

        const contestantFullNames = {
            "MRBOT1": "Thato Johannes", "MRBOT2": "Thato Letlole", "MRBOT3": "Thapelo Diane",
            "MRBOT4": "Moitshepi Godson Seametso", "MRBOT5": "Jacob Tshabalala", "MRBOT6": "Clifford Segotsi",
            "MRBOT7": "Kesaobaka Gaerekwe", "MRBOT8": "Martin Siele", "MRBOT9": "Emma Sedimo",
            "MRBOT10": "Cane Ramakgati", "MRBOT11": "Motse Same Dikgang", "MRBOT12": "Kabo Clement Molefi",
            "MRBOT13": "Kaone Marwane", "MRBOT14": "Thabang Motlhaolwa", "MRBOT15": "Ephraim Boy",
            "MRBOT16": "Poloko Tamanisa", "MRBOT17": "Prince Kealeboga Morotsi", "MRBOT18": "Gape Gadiwele"
        };

        function getMrBotsName(keyword) {
            if (!keyword) return "Contestant";
            const keywordStr = String(keyword).toUpperCase();
            const match = keywordStr.match(/MRBOT(\d+)/);
            return match && match[1] ? `Mr Bots ${match[1]}` : keywordStr;
        }

        function createContestantElement(id, data, rank) {
            const item = document.createElement('div');
            item.classList.add('contestant-item');
            item.setAttribute('data-keyword', id);
            const initialDisplayName = getMrBotsName(id);
            const displayRank = Number.isInteger(rank) && rank > 0 ? `${rank}.` : "";

            item.innerHTML = `
                <div class="contestant-main-info">
                    <span class="contestant-rank">${displayRank}</span>
                    <div class="contestant-details">
                        <div class="contestant-name">${initialDisplayName}</div>
                        <div class="vote-bar-container">
                            <div class="vote-bar" id="bar-${id}" style="width: 0%;"></div>
                        </div>
                    </div>
                    <span class="vote-count-display" id="count-${id}">${data.voteCount || 0}</span>
                </div>
                <div class="vote-log-details-wrapper" id="log-wrapper-${id}">
                    <ul class="vote-log-list" id="log-list-${id}"></ul>
                </div>
            `;
            item.querySelector('.contestant-main-info').addEventListener('click', () => {
                const keywordUpper = id.toUpperCase();
                const fullName = contestantFullNames[keywordUpper] || `${data.firstName || ''} ${data.lastName || ''}`.trim() || initialDisplayName;
                toggleVoteLog(id, item, fullName);
            });
            return item;
        }

        function updateContestantElement(id, data, rank) {
            const item = contestantsArea.querySelector(`.contestant-item[data-keyword="${id}"]`);
            if (!item) {
                // This can happen if element was removed by another process or during rapid updates.
                // console.warn(`updateContestantElement: Item not found for keyword ${id} during update.`);
                return;
            }
            
            const initialDisplayName = getMrBotsName(id);
            const displayRank = Number.isInteger(rank) && rank > 0 ? `${rank}.` : "";

            const rankEl = item.querySelector('.contestant-rank');
            if (rankEl) rankEl.textContent = displayRank;
            
            const nameEl = item.querySelector('.contestant-name');
            if (nameEl) nameEl.textContent = initialDisplayName;
            
            const countDisplay = item.querySelector(`#count-${id}`);
            const currentDisplayedCountOnPage = countDisplay ? (parseInt(countDisplay.textContent) || 0) : 0;
            const newVoteCount = data.voteCount || 0;

            if (countDisplay) countDisplay.textContent = newVoteCount;

            // --- BAR DEBUGGING ---
            console.log(`BAR_UPDATE for ${id}: voteCount from Firestore = ${newVoteCount}, VOTE_BAR_TARGET = ${VOTE_BAR_TARGET}`);

            const barPercentage = VOTE_BAR_TARGET > 0 ? (newVoteCount / VOTE_BAR_TARGET) * 100 : 0;
            console.log(`BAR_UPDATE for ${id}: Calculated barPercentage = ${barPercentage}%`);

            const barElement = item.querySelector(`#bar-${id}`);
            if (barElement) {
                const oldWidthStyle = barElement.style.width || "0%"; // Get current style before changing
                const oldWidthPercent = parseFloat(oldWidthStyle.replace('%','')) || 0;
                
                const newCalculatedWidthPercent = Math.min(barPercentage, 100); // Cap at 100%
                barElement.style.width = `${newCalculatedWidthPercent}%`;
                console.log(`BAR_UPDATE for ${id}: Set bar width to: ${newCalculatedWidthPercent}%`);

                // Shimmer effect logic
                if (newVoteCount > currentDisplayedCountOnPage && Math.abs(newCalculatedWidthPercent - oldWidthPercent) > 0.1) {
                    console.log(`BAR_UPDATE for ${id}: Applying shimmer effect.`);
                    barElement.classList.add('updating');
                    setTimeout(() => {
                        if (barElement) barElement.classList.remove('updating'); // Check if barElement still exists
                    }, 1000); 
                }
            } else {
                console.error(`BAR_UPDATE for ${id}: Bar element #bar-${id} not found!`);
            }
        }
        
        const contestantsQueryRef = collection(db, "contestants");
        const q = query(contestantsQueryRef, orderBy("voteCount", "desc"));

        onSnapshot(q, (querySnapshot) => {
            console.log("Firestore snapshot received. Number of contestants:", querySnapshot.size);
            if (loadingSpinner) loadingSpinner.style.display = 'none';

            // Nav loader completion logic (only if elements exist)
            if (firstLoad && navLoaderBar && navLoaderContainer) {
                navLoaderBar.style.width = '100%';
                setTimeout(() => { navLoaderContainer.classList.add('fade-out'); }, 1800);
                firstLoad = false;
            }
            
            const newElementsOrder = [];
            const elementsToKeep = new Map();

            querySnapshot.forEach((docSnap, index) => {
                const contestantId = docSnap.id;
                const contestantData = docSnap.data();
                const rank = index + 1;
                let element = contestantsArea.querySelector(`.contestant-item[data-keyword="${contestantId}"]`);
                if (element) {
                    updateContestantElement(contestantId, contestantData, rank);
                } else {
                    element = createContestantElement(contestantId, contestantData, rank);
                    // Call update again to set initial bar width and other properties
                    updateContestantElement(contestantId, contestantData, rank);
                }
                newElementsOrder.push(element);
                elementsToKeep.set(contestantId, element);
            });
            
            const currentDOMChildren = Array.from(contestantsArea.children);
            currentDOMChildren.forEach(child => {
                if (child.classList.contains('contestant-item')) {
                    const keyword = child.getAttribute('data-keyword');
                    if (!elementsToKeep.has(keyword)) {
                        child.remove(); // Remove contestants no longer in the snapshot
                    }
                }
            });

            // Re-order/append elements to match Firestore's ordered snapshot
            newElementsOrder.forEach((el, index) => {
                if (contestantsArea.children[index] !== el) {
                    if (contestantsArea.children[index]) {
                        contestantsArea.insertBefore(el, contestantsArea.children[index]);
                    } else {
                        contestantsArea.appendChild(el);
                    }
                }
            });
        }, (error) => {
            console.error("Error fetching contestants snapshot:", error);
            if (loadingSpinner) {
                loadingSpinner.textContent = "Error loading data. Check console and Firestore rules.";
                loadingSpinner.style.display = 'block';
            }
        });

        async function toggleVoteLog(keyword, contestantItemElement, fullNameForHeading) {
            // ... (toggleVoteLog function remains the same as the last fully working version) ...
            const logWrapperDiv = contestantItemElement.querySelector(`#log-wrapper-${keyword}`);
            const logListUl = contestantItemElement.querySelector(`#log-list-${keyword}`);
            if(!logWrapperDiv || !logListUl) return;
            const isAlreadyExpanded = contestantItemElement.classList.contains('expanded');

            document.querySelectorAll('.contestant-item.expanded').forEach(item => {
                if (item !== contestantItemElement) {
                    item.classList.remove('expanded');
                    const otherLogWrapper = item.querySelector('.vote-log-details-wrapper');
                    if (otherLogWrapper) otherLogWrapper.style.maxHeight = '0';
                }
            });
            
            contestantItemElement.classList.toggle('expanded', !isAlreadyExpanded);

            if (!isAlreadyExpanded) {
                let heading = logListUl.querySelector('h5.vote-log-heading');
                if (!heading) {
                    heading = document.createElement('h5');
                    heading.classList.add('vote-log-heading');
                    logListUl.prepend(heading);
                }
                heading.textContent = `Vote Details for ${fullNameForHeading}:`;
                
                let loadingItem = logListUl.querySelector('.loading-log-item');
                if (!loadingItem) {
                    Array.from(logListUl.querySelectorAll('li:not(.loading-log-item)')).forEach(li => li.remove());
                    loadingItem = document.createElement('li');
                    loadingItem.classList.add('vote-log-item', 'loading-log-item');
                    loadingItem.textContent = 'Loading...';
                    logListUl.appendChild(loadingItem);
                }
                logWrapperDiv.style.maxHeight = '80px';

                try {
                    const contestantDocRef = doc(db, "contestants", keyword);
                    const voteLogsColRef = collection(contestantDocRef, "voteLogs");
                    const voteLogsQuery = query(voteLogsColRef, orderBy("processedTimestamp", "desc"), firestoreLimit(50));
                    const voteLogsSnapshot = await getDocs(voteLogsQuery);
                    
                    if (loadingItem) loadingItem.remove();
                    Array.from(logListUl.querySelectorAll('li')).forEach(li => {
                        if(!li.classList.contains('vote-log-heading')) li.remove();
                    });

                    if (voteLogsSnapshot.empty) {
                        const noLogsItem = document.createElement('li');
                        noLogsItem.classList.add('vote-log-item');
                        noLogsItem.textContent = 'No individual votes recorded yet.';
                        logListUl.appendChild(noLogsItem);
                    } else {
                        voteLogsSnapshot.forEach(logDoc => {
                            const logData = logDoc.data();
                            const pTime = logData.processedTimestamp ? logData.processedTimestamp.toDate() : null;
                            const teleossTime = logData.teleossReceivedTime || 'N/A';
                            let voterDisplay = `Voter: ${logData.voterPhoneNumber ? (logData.voterPhoneNumber.length > 6 ? `${logData.voterPhoneNumber.substring(0,3)}***${logData.voterPhoneNumber.substring(logData.voterPhoneNumber.length - 4)}` : logData.voterPhoneNumber) : 'Anonymous'}`;

                            const listItem = document.createElement('li');
                            listItem.classList.add('vote-log-item');
                            listItem.innerHTML = `<span class="voter-num">${voterDisplay}</span> <span class="vote-time">Received: ${teleossTime}</span>`;
                            logListUl.appendChild(listItem);
                         });
                    }
                    logWrapperDiv.style.maxHeight = Math.min(logListUl.scrollHeight + (heading ? heading.offsetHeight : 0) + 20, 270) + "px";

                } catch (error) {
                    console.error("Error fetching vote logs for " + keyword + ":", error);
                    if (loadingItem) loadingItem.remove();
                    const errorItem = document.createElement('li');
                    errorItem.classList.add('vote-log-item');
                    errorItem.textContent = 'Error loading details.';
                    logListUl.appendChild(errorItem);
                    logWrapperDiv.style.maxHeight = logListUl.scrollHeight + (heading ? heading.offsetHeight : 0) + 20 + "px";
                }
            } else { 
                logWrapperDiv.style.maxHeight = '0';
            }
        }

        // --- Botswana Facts Cycler ---
        const botswanaFacts = [
            "Botswana is home to the Okavango Delta, one of the world's largest inland deltas.",
            "The Makgadikgadi Pans in Botswana are some of the largest salt flats globally.",
            "Botswana has the highest concentration of elephants in Africa.",
            "The country gained independence in 1966 and has maintained a stable democracy.",
            "Diamonds are a major export, contributing significantly to Botswana's economy.",
            "The Kalahari Desert covers about 70% of Botswana's land area.",
            "Botswana's currency is the Pula, meaning 'rain' or 'blessing' in Setswana.",
            "The San people are among the oldest inhabitants, with a rich cultural heritage.",
            "Chobe National Park is renowned for its vast elephant herds and diverse wildlife.",
            "Botswana is a landlocked country bordered by South Africa, Namibia, Zimbabwe, and Zambia."
        ];
        let currentFactIndex = 0;

        function displayNextFact() {
            if (botswanaFactDisplay) {
                botswanaFactDisplay.style.opacity = 0;
                setTimeout(() => {
                    currentFactIndex = (currentFactIndex + 1) % botswanaFacts.length;
                    botswanaFactDisplay.textContent = botswanaFacts[currentFactIndex];
                    botswanaFactDisplay.style.opacity = 1;
                }, 500); 
            }
        }
        if (botswanaFactDisplay && botswanaFacts.length > 0) {
            botswanaFactDisplay.textContent = botswanaFacts[currentFactIndex];
            setInterval(displayNextFact, 120000); // 2 minutes
        }


        const currentYearEl = document.getElementById('currentYear');
        if (currentYearEl) currentYearEl.textContent = new Date().getFullYear();

    } catch (initError) {
        console.error("CRITICAL: Firebase initialization failed!", initError);
        const loadingSpinner = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.innerHTML = "Application Error. Check Console.";
            loadingSpinner.style.display = 'block';
        }
    }
});