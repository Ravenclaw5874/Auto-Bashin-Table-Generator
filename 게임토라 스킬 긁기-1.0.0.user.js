// ==UserScript==
// @name         게임토라 스킬 긁기
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  try to take over the world!
// @author       Ravenclaw5874
// @match        https://gametora.com/ko/umamusume/skills
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gametora.com
// @grant        GM_getResourceText
// @grant        GM_registerMenuCommand
// @resource sheet file://D:\Downloads\스킬DB - 2.5주년 전.tsv
// ==/UserScript==

// tsv 데이터를 딕셔너리 배열로 변환하는 함수
function tsvToDictionaryArray(tsv) {
    const lines = tsv.split(/\r?\n/); // 줄 단위로 분할
    const headers = lines[0].split('\t'); // 헤더 정보 추출
    const data = [];

    // 각 줄을 딕셔너리로 변환하여 배열에 추가
    for (let i = 1; i < lines.length; i++) {
        // 빈 줄인지 확인
        if (lines[i].trim() === '') {
            continue; // 빈 줄이면 건너뜁니다.
        }

        const fields = lines[i].split('\t'); // 필드 분할
        const entry = {};

        // 각 필드를 헤더에 매핑하여 딕셔너리 생성
        for (let j = 0; j < headers.length; j++) {
            entry[headers[j]] = fields[j];
        }

        data.push(entry); // 딕셔너리를 배열에 추가
    }

    return data;
}

//큰원 -> 작은원
function changeSkillName(text) {
    return text.replace("◯", "○");
}

//Xpath로 요소 찾기
Node.prototype.xpath = function (xpath) {
    return document.evaluate(xpath, this, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

//href에서 html 가져오기
async function fetchPageDom(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const html = await response.text();
        // HTML 문자열을 DOM으로 변환
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // DOM 처리
        //console.log(doc);
        return doc;
    } catch (error) {
        console.error('There has been a problem with your fetch operation:', error);
    }
}

// n밀리초 동안 대기하는 함수
function wait(milliseconds) {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

function downloadDictionaryArrayAsTSV(dictionaryArray, filename) {
    let keys = new Set();
    dictionaryArray.forEach(dict => {
        Object.keys(dict).forEach(key => {
            keys.add(key);
        });
    });
    keys = [...keys];
    //const keys = Object.keys(longest);
    const rows = [keys, ...dictionaryArray.map(obj => keys.map(key => obj[key]))];
    const tsv = rows.map(row => row.join('\t')).join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${filename}.tsv`;
    link.href = url;
    link.click();
}

//단일 노드를 클릭한 뒤 추가된 노드를 반환
function observeAddedsNodeAfterClick_(element) {
    return new Promise(resolve => {
        // MutationObserver 생성
        const observer = new MutationObserver((mutations, observer) => {
            // DOM의 변화를 관찰하고 처리
            const addedNodes = mutations.flatMap(mutation => Array.from(mutation.addedNodes));
            const filteredNodes = addedNodes.filter(node => node.id.includes('tippy'));
            resolve(filteredNodes);
            // 관찰 종료
            observer.disconnect();
        });

        // MutationObserver 설정
        const config = { childList: true, subtree: true };
        observer.observe(document.body, config);

        // 요소 클릭
        element.click();

    });
}

//여러 노드를 클릭한 뒤 추가된 노드를 반환.
async function observeAddedNodesAfterClick(elements) {
    const addedNodes = [];
    for (const element of elements) {
        addedNodes.push(...await observeAddedsNodeAfterClick_(element));
        await wait(1);
    }
    return addedNodes;
}

//더보기 요소를 주면 href 배열 반환
async function getHrefArray(moreNode) {
    //moreNode.scrollIntoViewIfNeeded();
    const detail = (await observeAddedsNodeAfterClick_(moreNode))[0];
    await wait(1);
    const imgs = detail.querySelectorAll("span > span > img");
    const tippys = await observeAddedNodesAfterClick(imgs);
    const hrefs = tippys.map(tippy => {
        const a = tippy.querySelector("a");
        const b = tippy.querySelector("b");
        return (a === null && b !== null) ? b.textContent : a.href;
    });

    if (imgs.length !== tippys.length) {console.log("debug 차이", moreNode, imgs.length, tippys.length)}

    await wait(1);
    moreNode.click();
    await wait(300);

    return hrefs;
}

//날짜 텍스트 배열에서 가장 빠른 날짜를 반환
function getEarliestDate(dates) {
    if (dates.length === 0) {dates = ["9999년 9월 9일"]}
    let earliestDate = null;

    // 정규식을 이용하여 "년 월 일" 형식의 날짜 문자열에서 숫자만 추출합니다.
    const regex = /(\d{4})년 (\d{1,2})월 (\d{1,2})일/;

    for (const date of dates) {
        // 정규식을 사용하여 숫자를 추출합니다.
        const [, year, month, day] = date.match(regex);

        // 추출한 숫자를 이용하여 Date 객체를 생성합니다.
        const currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

        if (earliestDate === null || currentDate < earliestDate) {
            earliestDate = currentDate;
        }
    }

    return `${earliestDate.getFullYear()}년 ${earliestDate.getMonth() + 1}월 ${earliestDate.getDate()}일`;
}


//todo : 시나리오 출시일 미리 적어놓고 alt태그에서 가져와서 비교
// 고유기 데이터 계승기로 복사
async function downloadTSV() {
    const namuSheet = tsvToDictionaryArray(GM_getResourceText("sheet"));
    console.log(namuSheet);
    const hrefDateDict = {
        "URA 파이널즈" : "2021년 2월 24일",
        "아오하루배" : "2021년 8월 30일",
        "메이크 어 뉴 트랙" : "2022년 2월 24일",
        "그랜드 라이브" : "2022년 8월 24일",
        "그랜드 마스터즈" : "2023년 2월 24일",
        "프로젝트 L'Arc" : "2023년 8월 24일"
    };

    for (const skillInfo of namuSheet) {
        //이미 긁어왔으면 건너뜀
        if (skillInfo['스킬 id'] && skillInfo['스킬명(한섭)']) {continue;}

        console.log(skillInfo['스킬명(나무)'])


        //일섭명에 해당하는 row 가져오기
        skillInfo['스킬명(일섭)'] = changeSkillName(skillInfo['스킬명(일섭)']); //큰원 -> 작은원
        const jpnNameNode = document.xpath(`/html/body/div/div[1]/div/main/main/div[2]/div/div[position()=2 and text()="${skillInfo['스킬명(일섭)']}"]`);
        if (jpnNameNode === null) {
            console.log('debug 검색 불가: ',skillInfo['스킬명(일섭)']);
            continue;
        }
        const toraInfo = jpnNameNode.parentNode;
        toraInfo.scrollIntoViewIfNeeded();

        //id
        if (!skillInfo['스킬 id']) {
            skillInfo['스킬 id'] = toraInfo.xpath("div[4]/text()[2]").textContent.match(/\d+/)[0];
            if (skillInfo['희귀'] === '계승') {skillInfo['스킬 id'] = "9" + skillInfo['스킬 id'].slice(1);}
        }

        //스킬명(한섭)
        if (!skillInfo['스킬명(한섭)']) {
            const skillNameKor = toraInfo.querySelector(":scope > div:nth-child(3)").textContent;
            const japaneseAndChinesePattern = /[\u3040-\u30FF\u31F0-\u31FF\u4E00-\u9FFF\uFF65-\uFF9F]/;
            const containsJapaneseOrChinese = japaneseAndChinesePattern.test(skillNameKor);
            if (!containsJapaneseOrChinese) {
                skillInfo['스킬명(한섭)'] = skillNameKor;
            }
        }

        //보유 말딸
        if (!skillInfo['보유 말딸']) {
            if (toraInfo.querySelector(":scope > div:nth-child(4) > div") !== null) {
                skillInfo['보유 말딸'] = toraInfo.querySelector(":scope > div:nth-child(4) > div").textContent.match(/.+?\)/)[0];
            }
        }

        //예상 출시일
        if (!skillInfo['일섭 출시일'] && !skillInfo['예상 출시일']) {
            const moreNode = toraInfo.querySelector(":scope > div:nth-child(5) > span > span");
            const hrefArray = await getHrefArray(moreNode);
            const dateArray = [];

            for (const href of hrefArray) {
                //사전에 없으면 가져오기
                if (!hrefDateDict.hasOwnProperty(href)) {
                    if (href.startsWith("http")) {
                        const doc = await fetchPageDom(href);
                        const date = doc.xpath("//span[contains(text(), '년') and contains(text(), '월') and contains(text(), '일')]").textContent;
                        hrefDateDict[href] = date;
                    }
                    //사전에도 없고, url도 아닌 경우 건너뜀
                    else {
                        console.log('debug 오류 텍스트: ', href);
                        continue;
                    }
                }
                dateArray.push(hrefDateDict[href]);

            }
            skillInfo['일섭 출시일'] = getEarliestDate(dateArray);
        }

        //console.log('완성된 skillInfo: ', skillInfo);

    }

    console.log(namuSheet);
    downloadDictionaryArrayAsTSV(namuSheet, '게임토라');
}


(async function() {
    'use strict';
    // Your code here...
    GM_registerMenuCommand("다운로드",downloadTSV);
})();