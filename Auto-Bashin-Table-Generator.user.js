// ==UserScript==
// @name         우마무스메 자동 마신표 제작기
// @namespace    http://tampermonkey.net/
// @version      3.0.1
// @description  우마무스메 레이스 에뮬레이터로 마신표를 자동으로 만드는 스크립트입니다.
// @author       Ravenclaw5874
// @match        http://race-ko.wf-calc.net/
// @match        http://race.wf-calc.net/
// @match        https://ravenclaw5874.github.io/uma-emu/
// @match        http://localhost:8080/uma-emu/
// @icon         https://img1.daumcdn.net/thumb/C151x151/?fname=https%3A%2F%2Ft1.daumcdn.net%2Fcafeattach%2F1ZK1D%2F80ed3bb76fa6ce0a4a0c7a9cc33d55430f797e35
// @grant        GM_getResourceText
// @require      http://code.jquery.com/jquery-3.6.1.min.js
// @resource skillDBTsv https://raw.githubusercontent.com/Ravenclaw5874/Auto-Bashin-Table-Generator/main/%EC%8A%A4%ED%82%ACDB%20-%202.5%EC%A3%BC%EB%85%84%20%EC%A0%84.tsv
// @license      MIT License
// ==/UserScript==

/*----업데이트 로그------
3.0.1 Bang 전 미라클 버그 수정
3.0.0 2주년 대응. 진행도는 진화스킬 때문에 까다로워서 나중에.

2.2.5 명경, 또생 특이사항 불필요한 '}' 제거
2.2.4 스킬DB 분류 우선 방식 변경
2.2.3 스킬DB 분류 우선.
2.2.2 내,외 대응.
2.2.1 join 구분자 ',' -> ', '
2.2.0 전제 조건, 발동 조건 추가

2.1.1 adwrapper 때문에 localhost에서 테이블의 nth child 순서가 달라져서 nth child 빼버림.
2.1.0 중앙값 추가

2.0.3 가끔 멈추는 버그 수정
2.0.2 회복기를 활성화한 상태로 시뮬을 돌렸을 때, 특수기 시뮬 중 회복기가 원상복구 되도록 수정.
2.0.1 유저가 선택한 스킬의 하위 스킬도 스킵
2.0 1주년 대응

1.6.4 클구리 말괄량이 추가. 타임을 비교해서 하나만 추가하던 예전 방식 주석 제거.
1.6.3 클구리 두근두근 추가.
1.6.2 추입 하굣길 클구리 추가.
1.6.1 console.log 정리 및 테스트 버튼 제거
1.6 클구리 : 777과 U=ma2를 모두 결과에 포함.
    수르젠 : 코너회복으로 시뮬. 777과 U=ma2는 특이사항.

1.5.3 filename 사소한 변경.
1.5.2 패시브 기준 스킬을 계절 우마무스메 -> 단독으로 변경.
      전체 진행도에서 유저가 선택한 스킬을 제외하고 계산하도록 변경.
1.5.1 파일명에 활성화한 스킬도 추가
1.5 스킬 활성화 기능 추가. 유저가 돌린 조건을 첫째줄에 추가.

1.4.6 다운로드 파일 tsv 형식으로 변경
1.4.5 적성 마신 소수점 오류 수정
1.4.4 파일명에 스탯, 적성, 컨디션 정보 추가
1.4.3 버튼 간격 조정
1.4.2 ; 빠진곳 전부 추가
1.4.1 location.hash 처리 변경
1.4 함수 밖 return 해결.

1.3 클구리, 수르젠, 꼬올 일본서버 시뮬 지원. 스킬 DB는 아직.

1.2 전체 진행도 초기화 안되던 문제 수정

1.1 적성 음수 보정, 그외 각종 버그 수정

1.0 완성
*/

//selector 및 xpath 관리용
const selector = {
    '평균 랩타임' : "#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(2)",
    '표준 편차' : "#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(3)",
    '베스트 랩타임' : "#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(4)",
    '워스트 랩타임' : "#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(5)",
    '드롭다운 부모' : "body > div.el-select-dropdown.el-popper:last-child > div > div > ul",
    '고유기 레벨' : "#app > div.main-frame > form > div:nth-child(24) > div > div",
};
const xpath = {
    '진행도 바' : "/html/body/div[1]/div[1]/form/div[position()=22 or position()=23]/div[6]/div/div[2]/div[@role='progressbar']",
    '스킬 발동 구간' : "/html/body/div[1]/div[1]/form/div[position()=22 or position()=23]/div[5]/div/div/div[contains(@class, 'el-input')]",
    '한번 버튼' : "/html/body/div/div[1]/form/div[position()=22 or position()=23]/div[3]/div/button",
    '여러번 버튼' : "/html/body/div/div[1]/form/div[position()=22 or position()=23]/div[1]/div/button",
    '시뮬 횟수' : "/html/body/div/div[1]/form/div[position() > 20]/div[2]/div/div/div/input",
    '스킬 발동률 설정' : "/html/body/div[1]/div[1]/form/div[position()=22 or position()=23]/div[4]/div/div/div[contains(@class, 'el-input')]",
    '녹딱 레어' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[1]/div[2]/div/div[1]//div[@role='group']",
    '녹딱 일반' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[1]/div[2]/div/div[2]//div[@role='group']",
    '회복 계승' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[2]/div[2]/div/div[3]//div[@role='group']",
    '속도 레어' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[3]/div[2]/div/div[1]//div[@role='group']",
    '속도 일반' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[3]/div[2]/div/div[2]//div[@role='group']",
    '속도 계승' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[3]/div[2]/div/div[3]//div[@role='group']",
    '가속 레어' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[4]/div[2]/div/div[1]//div[@role='group']",
    '가속 일반' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[4]/div[2]/div/div[2]//div[@role='group']",
    '가속 계승' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[4]/div[2]/div/div[3]//div[@role='group']",
    '복합 레어' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[5]/div[2]/div/div[1]//div[@role='group']",
    '복합 일반' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[5]/div[2]/div/div[2]//div[@role='group']",
    '복합 계승' : "/html/body/div[1]/div[1]/form/div[@role='tablist']/div[5]/div[2]/div/div[3]//div[@role='group']",
    '진화' : "/html/body/div[1]/div[1]/form/div[21][@class='el-form-item']/div/div"
};


//Xpath로 요소 찾기
// JS path : document.querySelector("#el-collapse-content-2170 > div > div:nth-child(1) > div") 이런식으로 접속할때 마다 바뀌는 4자리 숫자가 붙음.
//function getElementByXpath(path) {
//    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
//}

//Xpath로 요소 찾기 확장형
Node.prototype.xpath = function (xpath) {
    return document.evaluate(xpath, this, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

//tsv 데이터를 딕셔너리 배열로 변환하는 함수
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

//딕셔너리 배열을 tsv로 다운로드
function downloadDictionaryArrayAsTSV(dictionaryArray, filename, firstLine) {
    let longest = dictionaryArray[0];
    for (let i = 1; i < dictionaryArray.length; i++) {
        if (Object.keys(dictionaryArray[i]).length > Object.keys(longest).length) {
            longest = dictionaryArray[i];
        }
    }
    const keys = Object.keys(longest);
    const rows = [keys, ...dictionaryArray.map(obj => keys.map(key => obj[key]))];
    const tsv = firstLine + rows.map(row => row.join('\t')).join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${filename}.tsv`;
    link.href = url;
    link.click();
}


//현재 요소가 몇번째 자식인지 알려줌.
function getIndex(element) {
    for (let i = 0; i < element.parentNode.children.length; i++) {
        if (element.parentNode.children[i] === element) {
            //logger('elemIndex = ' + i);
            return i;
        }
    }
}

//셀렉터들이나 요소들 한꺼번에 클릭
async function clickElements(selectors) {
    switch (typeof (selectors[0])) {
            //셀렉터 텍스트 배열일 경우
        case 'string':
            for (const selector of selectors) {
                await document.querySelector(selector).click();
            }
            break;
            //노드 리스트일 경우
        case 'object':
            for (const selector of selectors) {
                await selector.click();
            }
            break;
    }
}

//시뮬레이트 버튼을 클릭하고 끝나면 결과를 반환
function simulate(once) {
    return new Promise(async resolve => {
        //진행도 계산일 경우
        if (isPredict) {
            currentSimulateCount += once ? 1 : (userSimulateCount+5);
            let result = {
                        '평균': 1,
                        '베스트': 1,
                        '워스트': 1,
                        '표준 편차': '0.000',
                        '타임 배열': [1]
                    };
            resolve(result);
        }
        else {
            //매 시뮬 결과를 보여주지 않으므로 다시 진행도 바 감시로 복귀
            let target = document.xpath(xpath['진행도 바']);
            let option = { characterData: true, subtree: true };

            //감시자 동작 설정
            let observer = new MutationObserver(async (mutations) => {
                //매 시뮬마다 "마지막 시뮬레이션 결과 상세(2:31.93)" 의 2:31.93을 추출해서 eachTimes에 저장
                //let extractedText = extractTextBeside(document.querySelector("#app > div.main-frame > h3").innerText, '(', ')');
                //if (extractedText !== '-') { eachTimes.push(convertToSec(extractedText)); }

                //시뮬레이션 끝나면
                if (target.ariaValueNow === "100") {
                    //logger(`총 ${eachTimes.length}회`);
                    //감시자 제거
                    observer.disconnect();

                    let average = convertToSec(document.querySelector(selector['평균 랩타임']).innerText);
                    let SD = document.querySelector(selector['표준 편차']).innerText;
                    let eachTimes = document.querySelector("#allRaceTime").value.split(', ');
                    let fastest, slowest;

                    //전체 진행도 갱신
                    //if (userSimulateCount<=100) { currentSimulateCount+=1; }
                    //else { once? currentSimulateCount+=1: currentSimulateCount+= (userSimulateCount)/100; }
                    once ? currentOnceCount += 1 : currentMultipleCount += userSimulateCount;
                    currentSimulateCount = currentOnceCount + currentMultipleCount;
                    updateProgressBar(currentSimulateCount, totalSimulateCount);

                    //n번일땐 발동 구간 다섯개도 추가적으로 돌려서 최대 최소 계산
                    if (!once) {
                        let randomPosition_Results = [];
                        //n번 돌린 베스트, 워스트 랩타임을 포함
                        randomPosition_Results[0] = convertToSec(document.querySelector(selector['베스트 랩타임']).innerText);
                        randomPosition_Results[1] = convertToSec(document.querySelector(selector['워스트 랩타임']).innerText);

                        for (let i = 2; i < 7; i++) {
                            await randomPosition_Parent.childNodes[i].click();
                            randomPosition_Results[i] = (await simulate(true))['평균'];
                        }

                        fastest = Math.min(...randomPosition_Results);
                        slowest = Math.max(...randomPosition_Results);

                        await randomPosition_Parent.childNodes[1].click();
                    }
                    else {
                        fastest = average;
                        slowest = average;
                    }

                    //결과값 반환
                    let result = {
                        '평균': average,
                        '베스트': fastest,
                        '워스트': slowest,
                        '표준 편차': SD,
                        '타임 배열': eachTimes
                    }
                    resolve(result);
                }
            });

            //감시자 생성
            observer.observe(target, option);

            (once ?
             await document.xpath(xpath['한번 버튼']).click() ://한번 시뮬
             await document.xpath(xpath['여러번 버튼']).click());//n번 시뮬

            document.querySelector("body > div.v-modal").remove();
        }
    });
}

//텍스트에서 start와 end 사이의 텍스트 추출
function extractTextBeside(text, start, end) {
    const startIndex = text.indexOf(start);
    const endIndex = text.indexOf(end);

    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
        return text.substring(startIndex + 1, endIndex);
    }
}

//'1:23.456' 을 83.456으로 전환
function convertToSec(minSec) {
    let sepIndex = minSec.indexOf(':');
    let min = Number(minSec.substr(0, sepIndex));
    let sec = Number(minSec.substr(sepIndex + 1));
    return (min * 60 + sec).toFixed(3) * 1;
}

//배열의 중앙값 반환
function calculateMedian(array) {
    // 배열을 오름차순으로 정렬
    array.sort(function(a, b) {
        return a - b;
    });

    var length = array.length;
    var middleIndex = Math.floor(length / 2);

    if (length % 2 === 0) {
        // 배열의 길이가 짝수인 경우
        var middleValue1 = array[middleIndex - 1];
        var middleValue2 = array[middleIndex];
        return (middleValue1 + middleValue2) / 2;
    } else {
        // 배열의 길이가 홀수인 경우
        return array[middleIndex];
    }
}

//마신차 계산
function calcBashin(BASETIME, times) {
    //단일 숫자
    if (typeof (times) === 'number') {
        return ((BASETIME - times) * 10).toFixed(2) * 1;
    }
    //딕셔너리
    else {
        let result = {};
        /*for (let i=0;i<times.length;i++) {
            result.push( ((BASETIME - times[i])*10).toFixed(2)*1 );
        }*/
        result['평균'] = ((BASETIME - times['평균']) * 10).toFixed(2) * 1;
        result['최대'] = ((BASETIME - times['베스트']) * 10).toFixed(2) * 1;
        result['최소'] = ((BASETIME - times['워스트']) * 10).toFixed(2) * 1;
        result['표준 편차'] = (times['표준 편차'] * 10).toFixed(2) * 1;

        //const flooredBasetime = Math.floor(BASETIME * 100) / 100;
        result['마신 배열'] = times['타임 배열'].map(time => ((BASETIME - time) * 10).toFixed(2) * 1);
        result['중앙'] = calculateMedian(result['마신 배열']).toFixed(2) * 1;
        return result;
    }
}

//최대 마신을 구해서 (5.83) 0.5 구간으로 나눈다음 (0.5, 1.0, 1.5... 5.5) 그 값 이상인 비율을 skillData에 넣어줌.
function addRatio(skillData, bashins) {
    const quotient = Math.floor(bashins['최대'] / 0.5)
    const maxDot5 = quotient * 0.5;

    for (let i = 1; i <= quotient; i++) {
        const keyString = `≥${0.5 * i}`;
        const ratio = (bashins['마신 배열'].filter(bashin => bashin >= 0.5 * i).length / bashins['마신 배열'].length).toFixed(2) * 1;
        skillData[keyString] = ratio;
        //logger(skillData);
    }
}

//텍스트의 양옆 공백 제거 및 ○ -> ◯ 변환(큰원으로)
function getProperSkillName(skillElement) {
    return skillElement.innerText.trim();//.replace('○', '◯');
}

//스킬 노드 배열 넣으면 이름 배열 반환
function makeSkillNamesArray(skillElements) {
    let result = [];
    skillElements.forEach((node) => { result.push(getProperSkillName(node)); });
    return result;
}

//스킬 노드 배열 넣으면 id 배열 반환
function makeSkillIdArray(skillElements) {
    return Array.from(skillElements).map(element => getSkillIdByElement(element));
}

//전체 진행도 바 생성
function createProgressBar(current, all) {
    let original = document.xpath(xpath['진행도 바']);
    let newProgressbar = original.cloneNode(true);
    original.after(newProgressbar);
    newProgressbar.before(`(${current}/${all})단계 완료까지`);
    newProgressbar.before(' 약 h시간 mm분 ss초')

    return newProgressbar;
}

//전체 진행도 바 제거
function removeProgressBar(progressbar) {
    progressbar.previousSibling.remove();
    progressbar.previousSibling.remove();
    progressbar.remove();
}



//전체 진행도 바 업데이트
function updateProgressBar(currentSimulateCount, totalSimulateCount) {
    const elapsedCount = currentSimulateCount - previousCount;
    const remainCount = totalSimulateCount - currentSimulateCount;
    const percent = parseInt(currentSimulateCount / totalSimulateCount * 100)

    entire_progressbar.ariaValueNow = percent;
    entire_progressbar.querySelector("div.el-progress-bar > div > div").setAttribute("style", `width: ${percent}%`);
    entire_progressbar.querySelector("div.el-progress__text").innerText = `${percent}%`;

    if (elapsedCount > userSimulateCount || (remainCount < userSimulateCount && remainCount > 0)) {
        const currentTime = performance.now()
        const elapsedTime = currentTime - previousTime;
        const remainTime = remainCount / elapsedCount * elapsedTime; //밀리초
        logger(`경과 ${elapsedTime}밀리초 경과수 ${elapsedCount}개 앞으로 ${remainTime}밀리초 앞으로 ${remainCount}개`);
        entire_progressbar.previousSibling.textContent = ` 약 ${formatMilliseconds(remainTime)}`;
        previousTime = currentTime;
        previousCount = currentSimulateCount;
    }


}

//밀리초 포맷
function formatMilliseconds(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const formattedTime = `${hours}시간 ${minutes % 60}분 ${seconds % 60}초`;

    return formattedTime;
}

//스킬이 고유기인지 계승/일반기인지 판단
function isUniqueSkill(skillElement) {
    //스킬 Element 내부의 span 요소를 받았을 경우, 그 parent를 재할당.
    //결과적으로 li(고유기) 혹은 label(계승, 일반기) Element가 할당되어야 한다.
    if (skillElement.nodeName === 'SPAN') { skillElement = skillElement.parentElement; }

    //고유기
    if (skillElement.classList.contains('el-select-dropdown__item')) { return true; }

    //계승, 일반기
    else if (skillElement.classList.contains('el-checkbox-button')) { return false; }

    else return;//undefined
}

//스킬의 현재 활성화 여부를 리턴
function checkSkillStatus(skillElement) {
    //스킬 Element 내부의 span 요소를 받았을 경우, 그 parent를 재할당.
    //결과적으로 li(고유기) 혹은 label(계승, 일반기) Element가 할당되어야 한다.
    if (skillElement.nodeName === 'SPAN') { skillElement = skillElement.parentElement; }

    switch (isUniqueSkill(skillElement)) {
        case true:
            //고유기
            return skillElement.classList.contains('selected');

        case false:
            //계승, 일반기
            return skillElement.classList.contains('is-checked');

            //어느것도 아님
        case undefined:
            return;
    }
}

//스킬을 활성화/비활성화
async function toggleSkill(skillElement, newStatus) {
    //스킬 Element 내부의 span 요소를 받았을 경우, 그 parent를 재할당.
    //결과적으로 li(고유기) 혹은 label(계승, 일반기) Element가 할당되어야 한다.
    if (skillElement.nodeName === 'SPAN') { skillElement = skillElement.parentElement; }

    // undefined거나 or 바꾸고자 하는 상태와 현재 상태가 같으면 아무것도 하지 않고, 변경이 실패했음(false)을 반환.
    if (checkSkillStatus(skillElement) === undefined || checkSkillStatus(skillElement) === newStatus) return false;

    // 고유기를 비활성화하는 경우
    else if (isUniqueSkill(skillElement) && newStatus === false) {
        // 2번째 고유기(없음/발동하지 않음) 클릭
        await skillElement.parentElement.children[0].click();
    }

    // 그 외의 경우, 현재 상태와 바꾸고자 하는 상태가 다르면 클릭
    else await skillElement.click();
    return true; //변경 성공
}


//여러 스킬을 활성화/비활성화
async function toggleSkills(skillElements, newStatus) {
    const isToggled = [];

    //배열 아니면 배열화
    if (!Array.isArray(skillElements)) {
        skillElements = [skillElements];
    }

    for (let i = 0; i < skillElements.length; i++) {
        const status = Array.isArray(newStatus) ? newStatus[i % newStatus.length] : newStatus;
        isToggled.push(await toggleSkill(skillElements[i], status));
    }

    return isToggled;
}


//진행도 계산용 전역변수
let userSimulateCount = 0; //유저가 설정한 시뮬 횟수
let totalSimulateCount = 0; //계산된 총 시뮬 횟수
let currentSimulateCount = 0; //현재 누적 시뮬 횟수
let currentOnceCount = 0;
let currentMultipleCount = 0;
let predictSimulateCount = 0; //예상 시뮬 횟수 누적용
let previousTime = performance.now();
let previousCount = 0;
let entire_progressbar; //전체 진행 바 요소
let skillDB = null;
let isPredict = false;
let randomPosition_Parent = null; //simulate 함수에서 발동 구간 바꿀 수 있게 전역화

function resetGlobalVariables() {
    userSimulateCount = 0; //유저가 설정한 시뮬 횟수
    totalSimulateCount = 0; //계산된 총 시뮬 횟수
    currentSimulateCount = 0; //현재 누적 시뮬 횟수
    currentOnceCount = 0;
    currentMultipleCount = 0;
    predictSimulateCount = 0;
    previousTime = performance.now();
    previousCount = 0;
}

//로그 on/off용
const isLoggerOn = true;

function logger(content) {
    if (isLoggerOn) {
        switch (typeof (content)) {
            case 'object':
                console.table(content);
                console.log(content);
                break;
            default:
                console.log(content);
                break;
        }
    }
}

//고유기 레벨 변경
function changeUniqueSkillLevel(num) {
    const target = document.querySelector(selector['고유기 레벨']);
    target.__vue__.value = num;
}

//스킬id로 일반스킬 찾기
function getSkillElementById(id) {
    return document.querySelector(`label:has(> input[value='${id}'])`)
}

//고유기 일반기 상관없이 스킬 id 반환
function getSkillIdByElement(element) {
    //일반기
    if (element.tagName === 'LABEL') {
        return element.querySelector(":scope > input").value;
    }
    //고유기
    else if (element.tagName === 'LI') {
        //'없음/발동하지 않음' 일 경우
        if (getIndex(element) === 0) {
            return '000000';
        }
        const skillname = getProperSkillName(element);
        const label = document.xpath(`//label[span[normalize-space(text())="${skillname}"]]`)
        if (label) {
            const inheritId = label.querySelector(":scope > input").value;
            return "1" + inheritId.slice(1);
        }
        //고유기는 있는데 계승기는 없는 경우. Never say never 등.
        else {
            //고유기면서 스킬명(나무)나 스킬명(일섭)에서 이름이 일치하는 스킬 반환
            const skillName = getProperSkillName(element);
            const skillData = skillDB.find(v => (v['희귀'] === '고유') && (v['스킬명(한섭)'] === skillName || v['스킬명(나무)'] === skillName || v['스킬명(일섭)'] === skillName));
            if(skillData) {
                return skillData['스킬 id'];
            }
            else {
                console.error('스킬 id 못찾음:', skillName);
                return;
            }
        }
    }
    else return;
}

//트리거 스킬 id 텍스트 2차원 배열로 분해
function splitTriggerText(text) {
    return text.split(', ').map(e => e.split('/'));
}

//중복 요소가 존재하는 오름차순 배열을 이진 검색
function binarySearch(arr, key, target, findFirst) {
    let left = 0;
    let right = arr.length - 1;
    let result = -1;

    while (left <= right) {
        let mid = Math.floor((left + right) / 2);

        if (parseFloat(arr[mid][key]) === parseFloat(target)) {
            result = mid;
            if (findFirst) {
                right = mid - 1; // 첫 번째 위치를 찾기 위해 더 왼쪽을 탐색
            } else {
                left = mid + 1; // 마지막 위치를 찾기 위해 더 오른쪽을 탐색
            }
        } else if (parseFloat(arr[mid][key]) < parseFloat(target)) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    return result;
}

//이진검색 사용한 필터
Array.prototype.binaryFilter = function(key, targetValue) {
    let firstIndex = binarySearch(this, key, targetValue, true);
    if (firstIndex === -1) {
        return []; // 해당 값의 요소가 없는 경우 빈 배열 반환
    }

    let lastIndex = binarySearch(this, key, targetValue, false);

    return this.slice(firstIndex, lastIndex + 1);
};


//시뮬 프리셋마다 실행됨.
async function main(current, all) {
    'use strict';
    // Your code here...
    resetGlobalVariables();


    //--------------------------------------------------값 읽어오기-------------------------------------------------------

    //진행도 바 활성화를 위한 한번 시뮬
    await document.xpath(xpath['한번 버튼']).click();

    //스킬 DB 불러오기
    //let skillDB_csv = await $.get("https://raw.githubusercontent.com/Ravenclaw5874/Auto-Bashin-Table-Generator/main/%EC%8A%A4%ED%82%ACDB%20-%201%EC%A3%BC%EB%85%84~.csv");
    //const skillDB_csv = await $.get("https://raw.githubusercontent.com/Ravenclaw5874/Auto-Bashin-Table-Generator/main/%EC%8A%A4%ED%82%ACDB%20-%202.5%EC%A3%BC%EB%85%84%20%EC%A0%84.csv");
    //skillDB = $.csv.toObjects(skillDB_csv);
    //logger(skillDB);


    //시뮬 횟수 얼만지 가져오기
    userSimulateCount = Number(document.xpath(xpath['시뮬 횟수']).ariaValueNow);

    //전체 난수 고정 선택
    await document.xpath(xpath['스킬 발동률 설정']).click();
    await document.querySelector(`${selector['드롭다운 부모']} > li:nth-child(3)`).click();

    //스킬 발동 구간 부모 할당
    //스킬 발동 구간 드롭다운 메뉴를 클릭해서 최하위로 보낸뒤 주소 가져옴.
    await document.xpath(xpath['스킬 발동 구간']).click();
    randomPosition_Parent = document.querySelector(selector['드롭다운 부모']);

    //현재 설정된 정보를 읽어서 저장
    let simulateOptionSelectors = [
        "#app > div.main-frame > form > div:nth-child(14) > div > div > div",//각질
        "#app > div.main-frame > form > div:nth-child(15) > div > div > div",//거리 적성
        "#app > div.main-frame > form > div:nth-child(16) > div > div > div",//경기장 적성
        "#app > div.main-frame > form > div:nth-child(17) > div > div > div",//각질 적성
        "#app > div.main-frame > form > div:nth-child(18) > div > div > div",//컨디션
        "#app > div.main-frame > form > div:nth-child(20) > div > div:nth-child(1) > div",//코스 장소
        "#app > div.main-frame > form > div:nth-child(20) > div > div:nth-child(2) > div",//코스 종류 및 거리
        "#app > div.main-frame > form > div:nth-child(21) > div > div > div",//코스 상태
        "#app > div.main-frame > form > div:nth-child(23) > div > div > div"//고유 스킬
    ];

    await clickElements(simulateOptionSelectors); //드롭다운 전부 클릭

    let dropDownNodes = document.querySelectorAll("body > div.el-select-dropdown.el-popper");

    //드롭다운 요소들의 부모들 저장용
    let dropDownParent = {
        '각질': dropDownNodes[dropDownNodes.length - 9].querySelector("div > div > ul"),
        '거리 적성': dropDownNodes[dropDownNodes.length - 8].querySelector("div > div > ul"),
        '경기장 적성': dropDownNodes[dropDownNodes.length - 7].querySelector("div > div > ul"),
        '각질 적성': dropDownNodes[dropDownNodes.length - 6].querySelector("div > div > ul"),
        '컨디션': dropDownNodes[dropDownNodes.length - 5].querySelector("div > div > ul"),
        '코스 장소': dropDownNodes[dropDownNodes.length - 4].querySelector("div > div > ul"),
        '코스 종류 및 거리': dropDownNodes[dropDownNodes.length - 3].querySelector("div > div > ul"),
        '코스 상태': dropDownNodes[dropDownNodes.length - 2].querySelector("div > div > ul"),
        '고유기': dropDownNodes[dropDownNodes.length - 1].querySelector("div > div > ul")
    };


    //유저가 설정한 시뮬 환경 저장용
    let userSelected = {
        '각질': dropDownParent['각질'].querySelector("ul > li.selected").innerText,
        '거리 적성': dropDownParent['거리 적성'].querySelector("ul > li.selected"),
        '경기장 적성': dropDownParent['경기장 적성'].querySelector("ul > li.selected"),
        '각질 적성': dropDownParent['각질 적성'].querySelector("ul > li.selected").innerText,
        '컨디션': dropDownParent['컨디션'].querySelector("ul > li.selected").innerText,
        '코스 장소': dropDownParent['코스 장소'].querySelector("ul > li.selected").innerText,
        '코스 종류 및 거리': dropDownParent['코스 종류 및 거리'].querySelector("ul > li.selected").innerText,
        '코스 상태': dropDownParent['코스 상태'].querySelector("ul > li.selected").innerText,
        '스탯': [
            document.querySelector("#app > div.main-frame > form > div:nth-child(8) > div > div > input").value,
            document.querySelector("#app > div.main-frame > form > div:nth-child(9) > div > div > input").value,
            document.querySelector("#app > div.main-frame > form > div:nth-child(10) > div > div > input").value,
            document.querySelector("#app > div.main-frame > form > div:nth-child(11) > div > div > input").value,
            document.querySelector("#app > div.main-frame > form > div:nth-child(12) > div > div > input").value],
        '고유기 레벨': document.querySelector(`${selector['고유기 레벨']} > div > input`).ariaValueNow,
        '전체 스킬': [], //유저가 선택한 전체 고유기 계승기 일반기 '이름' 저장용
        '전체 스킬 id': [],
        '고유기': '',
        '고유기 id' : '',
        '계승/일반기': [], //유저가 선택한 계승기 일반기 '이름' 저장용
        '계승/일반기 id': []
    };

    //거리 넣으면 단마중장 분류해줌.
    function getDistanceCategory(meter) {
        if (meter < 1600) { return '단거리'; }
        else if (meter < 2000) { return '마일'; }
        else if (meter <= 2400) { return '중거리'; }
        else { return '장거리'; }
    }

    //잔디 1200m(I) 단거리
    userSelected['마장'] = userSelected['코스 종류 및 거리'].includes('잔디') ? '잔디' : '더트'; //잔디
    userSelected['거리'] = parseInt(userSelected['코스 종류 및 거리'].replace(userSelected['마장'], '')); //1200m
    const matchInOut = userSelected['코스 종류 및 거리'].match(/\((\w)\)/);
    userSelected['내외'] = matchInOut ? matchInOut[1] : ""; // I, O, ""
    userSelected['거리 분류'] = getDistanceCategory(userSelected['거리']) //단거리


    //유저가 활성화한 계승/일반기 찾아서 저장
    document.querySelectorAll("div.el-collapse label.el-checkbox-button.is-checked").forEach((e) => {
        userSelected['계승/일반기'].push(getProperSkillName(e));
        userSelected['계승/일반기 id'].push(getSkillIdByElement(e));
    });
    //delete userSelected['전체 스킬'].push(...userSelected['계승/일반기']); //내용물 '복사'
    userSelected['전체 스킬 id'].push(...userSelected['계승/일반기 id']);

    //유저가 고유기를 선택했는가?
    let isUniqueSkillSelected = false;
    let userSelectedUniqueSkill = dropDownParent['고유기'].querySelector("ul > li.el-select-dropdown__item.selected");
    // 선택된 고유기가 있고, 그게 없음/발동 안함이 아니면
    if (userSelectedUniqueSkill && userSelectedUniqueSkill !== dropDownParent['고유기'].children[0]) {
        isUniqueSkillSelected = true;
        logger(`고유기 활성화됨! ${getProperSkillName(userSelectedUniqueSkill)}`);
        //delete userSelected['전체 스킬'].push(getProperSkillName(userSelectedUniqueSkill));
        userSelected['고유기'] = getProperSkillName(userSelectedUniqueSkill);
        const UniqueId = getSkillIdByElement(userSelectedUniqueSkill);
        userSelected['전체 스킬 id'].push(UniqueId);
        userSelected['고유기 id'] = UniqueId;
    }
    logger(userSelected);

    //logger("작전: " + userSelected['각질']);
    //logger("적성: " + userSelected['거리 적성'].innerText + " " + userSelected['경기장 적성'].innerText + " " + userSelected['각질 적성']);
    //logger("컨디션: " + userSelected['컨디션']);
    //logger("코스: " + userSelected['코스 장소'] + " " + userSelected['코스 종류 및 거리'] + " " + userSelected['코스 상태']);

    await clickElements(simulateOptionSelectors); //드롭다운 전부 닫기

    /*function findMatches(elements, matchText) {
        let matchedElements = [];
        elements.forEach(e => {
            if (e.nodeType === 1 && e.matches(matchText)) {
                matchedElements.push(e);
            }
        });
        return matchedElements;
    }*/


    //계승 포함 전체 일반기들
    let normalSkillElements = {
        '속도': {
            '레어/상위': document.xpath(xpath['속도 레어']).children,
            '일반/하위': document.xpath(xpath['속도 일반']).children,
            '계승':    document.xpath(xpath['속도 계승']).children
        },
        '가속': {
            '레어/상위': document.xpath(xpath['가속 레어']).children,
            '일반/하위': document.xpath(xpath['가속 일반']).children,
            '계승':    document.xpath(xpath['가속 계승']).children
        },
        '복합': {
            '레어/상위': document.xpath(xpath['복합 레어']).children,
            '일반/하위': document.xpath(xpath['복합 일반']).children,
            '계승':    document.xpath(xpath['복합 계승']).children
        }
    };
    console.log('디버그', normalSkillElements);

    //유저가 선택한 {일반/계승기, 요소, 상위 스킬 이름 배열}을 저장할 사전 배열
    let normalRareMap = [];
    let userSelectedNormalSkillElements = [
        ...Array.from(normalSkillElements['속도']['레어/상위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['속도']['일반/하위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['속도']['계승']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['가속']['레어/상위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['가속']['일반/하위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['가속']['계승']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['복합']['레어/상위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['복합']['일반/하위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['복합']['계승']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
    ];
    userSelectedNormalSkillElements.forEach(e => {
        //delete let skillName = getProperSkillName(e)
        //delete let skillData = skillDB.find(v => v['스킬명(한섭 시뮬)'] === skillName);
        //delete let upperSkillNameArray = skillDB.filter(v => v['그룹'] === skillData['그룹'] && v['단계'] > skillData['단계']).map(v => v['스킬명(한섭 시뮬)']);
        //delete let lowerSkillNameArray = skillDB.filter(v => v['그룹'] === skillData['그룹'] && v['단계'] < skillData['단계']).map(v => v['스킬명(한섭 시뮬)']);

        const skillId = getSkillIdByElement(e);
        const skillData = skillDB.find(v => v['스킬 id'] === skillId);
        const upperSkillIdArray = skillDB.filter(v => v['그룹'] === skillData['그룹'] && v['단계'] > skillData['단계']).map(v => v['스킬 id']);
        const lowerSkillIdArray = skillDB.filter(v => v['그룹'] === skillData['그룹'] && v['단계'] < skillData['단계']).map(v => v['스킬 id']);

        normalRareMap.push({
            //delete '스킬 이름': skillName,
            //delete '상위 스킬 이름 배열': upperSkillNameArray,
            //delete '하위 스킬 이름 배열': lowerSkillNameArray
            '스킬 id': skillId,
            '스킬 요소': e,
            '상위 스킬 id 배열': upperSkillIdArray,
            '하위 스킬 id 배열': lowerSkillIdArray
        });
    });

    //스킬이 유저가 선택한 스킬의 상위 스킬인지 확인하고 맞다면 하위 스킬의 요소를 반환
    //직주 기준 마신표일때, 육박하는 그림자를 시뮬하려면 직주를 끄고 돌린뒤 다시 켜야함.
    //즉 육박하는 그림자가 들어오면 직주 element를 돌려줘야함.
    function checkUpperSkillandReturnLowerSkillElement(upperSkillId) {
        //normalRareMap.forEach(d => { d['상위 스킬 이름 배열'].includes(upperSkillName) })
        /*delete for (let i = 0; i < normalRareMap.length; i++) {
            if (normalRareMap[i]['상위 스킬 이름 배열'].includes(upperSkillName)) {
                return normalRareMap[i]['스킬 요소'];
            }
        }*/
        for (const userSelectedSkill of normalRareMap) {
            if (userSelectedSkill['상위 스킬 id 배열'].includes(upperSkillId)) {
                return userSelectedSkill['스킬 요소'];
            }
        }
        return false;
    }

    function isLowerSkillOfUserSelected(lowerSkillId) {
        //delete for (let i = 0; i < normalRareMap.length; i++) {
        for (const userSelectedSkill of normalRareMap) {
            if (userSelectedSkill['하위 스킬 id 배열'].includes(lowerSkillId)) {
                return true;
            }
        }
        return false;
    }

    //고유기들
    //let uniqueSkills = {
    //    '회복': {
    //        '2성': {
    //            '요소 배열': [],
    //            //delete '이름 배열': ['클리어 하트', '두근두근 준비 땅!'],
    //            'id 배열': ['10451', '10521']
    //        },
    //        '3성': {
    //            '요소 배열': [],
    //            //delete '이름 배열': makeSkillNamesArray(document.xpath(xpath['회복 계승']).children),
    //            'id 배열': makeSkillIdArray(document.xpath(xpath['회복 계승']).children)
    //        }
    //    },
    //    '속가복': {
    //        /*'2성': {
    //            '요소 배열': [],
    //            '이름 배열': []
    //        },*/
    //        '3성': {
    //            '요소 배열': [],
    //            'id 배열': [
    //                ...makeSkillIdArray(normalSkillElements['속도']['계승']),
    //                ...makeSkillIdArray(normalSkillElements['가속']['계승']),
    //                ...makeSkillIdArray(normalSkillElements['복합']['계승'])
    //            ]
    //        }
    //    },
    //}

    //타키온 고유기가 회복기면 제거할 대상에 2성 고유기 추가.
    //if (uniqueSkills['회복']['3성']['id 배열'].includes('100321')) {
    //    uniqueSkills['회복']['2성']['id 배열'].push('10321');
    //}

    //전체 고유기
    let unique_Skill_Elements = Array.from(dropDownParent['고유기'].children); //HTMLCollection -> 배열로 변환
    const no_unique_skill_element = unique_Skill_Elements.shift(); //고유기 없음 요소

    //제거할 스킬id들
    //const needToDelete_SkillIds = ['000000',
    //                               ...uniqueSkills['회복']['3성']['id 배열'],
    //                               ...uniqueSkills['회복']['2성']['id 배열']];

    //전체 속/가/복 고유기 '요소'들.
    //let notHeal_unique_Skill_Elements = unique_Skill_Elements.filter(x => !needToDelete_SkillIds.includes(getSkillIdByElement(x)));
    //uniqueSkills['속가복']['3성']['요소 배열'] = notHeal_unique_Skill_Elements;
    //2성 속/가/복 고유기 '요소'들
    //uniqueSkills['속가복']['2성']['요소 배열'] = notHeal_unique_Skill_Elements.filter(x => !uniqueSkills['속가복']['3성']['이름 배열'].includes(getProperSkillName(x)));
    //3성 속/가/복 고유기 '요소'들.
    //uniqueSkills['속가복']['3성']['요소 배열'] = notHeal_unique_Skill_Elements.filter(x => uniqueSkills['속가복']['3성']['이름 배열'].includes(getProperSkillName(x)));



    //--------------------------------------------------진행도용 전체 시뮬 횟수 계산-------------------------------------------------------
    let result_Final = {};

    totalSimulateCount = 100000;


    //전체 진행도 바 생성
    entire_progressbar = createProgressBar(current, all);
    updateProgressBar(currentSimulateCount, totalSimulateCount);


    //--------------------------------------------------마신 계산 시작-------------------------------------------------------

    //기준 타임 계산
    //let basetimes = await simulate(true);
    const BASETIME = (await simulate(true))['평균'];
    logger('기준 타임: ' + BASETIME);

    //--------------------------------------------------적성 마신 계산-------------------------------------------------------
    result_Final['적성'] = [];

    //유저가 선택한 적성 인덱스
    let index_dist = getIndex(userSelected['거리 적성']);
    let index_surf = getIndex(userSelected['경기장 적성']);

    //거리S 경기장S로 돌려도 비교를 위해 최소 AA까지는 시뮬.
    for (let i = 0; i <= (index_dist === 0 ? 1 : index_dist); i++) {
        for (let j = 0; j <= (index_surf === 0 ? 1 : index_surf); j++) {
            //logger(dropDownParent['거리 적성'].childNodes[i].innerText + " " + dropDownParent['경기장 적성'].childNodes[j].innerText);
            await dropDownParent['거리 적성'].children[i].click();
            await dropDownParent['경기장 적성'].children[j].click();

            let row = {
                '희귀': '적성',
                '분류': '적성',
                '마신': calcBashin(BASETIME, await simulate(true))['평균'],
                '스킬명(나무)': userSelected['거리 분류'] + dropDownParent['거리 적성'].children[i].innerText + ' ' + userSelected['마장'] + dropDownParent['경기장 적성'].children[j].innerText,
                '예상 출시일': '2022년 6월 20일'
            };

            result_Final['적성'].push(row);
        }
    }

    //제일 마지막 적성의 마신이 음수면 S이상으로 돌려서 A까지 간것이므로 모든 요소에 그만큼 더하기.
    let lastBashin = result_Final['적성'][result_Final['적성'].length - 1]['마신'];
    if (lastBashin < 0) {
        result_Final['적성'].forEach((row) => {
            row['마신'] += (-lastBashin);
            row['마신'] = row['마신'].toFixed(2) * 1;
        });
    }

    //적성 원상복구
    await userSelected['거리 적성'].click();
    await userSelected['경기장 적성'].click();


    //logger(result_Final['적성']);
    //logger(`~적성 예상 횟수 : ${partCount.적성once + partCount.적성multi}, once : ${partCount.적성once}, multiple : ${partCount.적성multi}`);
    //logger(`~적성 실제 횟수 : ${currentSimulateCount}, once : ${currentOnceCount}, multiple : ${currentMultipleCount}`);


    //--------------------------------------------------녹딱 마신 계산-------------------------------------------------------
    result_Final['녹딱'] = [];

    let passiveParents = {
        '상위': document.xpath(xpath['녹딱 레어']),
        '하위': document.xpath(xpath['녹딱 일반'])
    };
    let passiveSkillElements = {
        '스피드 80': passiveParents['상위'].querySelector("input[value='200271']").parentElement, //단독◎
        '스피드 60': passiveParents['상위'].querySelector("input[value='200301']").parentElement, //복병◎
        '스피드 40': passiveParents['하위'].querySelector("input[value='200302']").parentElement, //복병○
        '스피드 파워 60': passiveParents['상위'].querySelector("input[value='-200174']").parentElement, //첫 봄바람
        '파워 60': passiveParents['상위'].querySelector("input[value='200281']").parentElement, //대항의식◎
        '파워 40': passiveParents['하위'].querySelector("input[value='200282']").parentElement, //대항의식○
        '근성 60': passiveParents['상위'].querySelector("input[value='200291']").parentElement, //집중마크◎
        '근성 40': passiveParents['하위'].querySelector("input[value='200292']").parentElement, //집중마크○
        '승부사': passiveParents['상위'].querySelector("input[value='202441']").parentElement, //승부사
        '모험심': passiveParents['하위'].querySelector("input[value='202442']").parentElement, //모험심
    };

    /*let speed_rare = document.xpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[1]/div/label[3]/span');
        let power_rare = document.xpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[1]/div/label[9]/span');
        let speed_normal = document.xpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[2]/div/label[3]/span');
        let power_normal = document.xpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[2]/div/label[11]/span');


        result_Final['녹딱'][0] = await makeCompleteSkillData(speed_rare, '레어/상위', '녹딱', '스피드◎');
        result_Final['녹딱'][1] = await makeCompleteSkillData(power_rare, '레어/상위', '녹딱', '파워◎');
        result_Final['녹딱'][2] = await makeCompleteSkillData(speed_normal, '일반/하위', '녹딱', '스피드◯');
        result_Final['녹딱'][3] = await makeCompleteSkillData(power_normal, '일반/하위', '녹딱', '파워◯');*/

    result_Final['녹딱'].push(...(await makeCompleteSkillData(passiveSkillElements['스피드 80'], '레어/상위', '녹딱', '스피드 80', true)));
    result_Final['녹딱'].push(...(await makeCompleteSkillData(passiveSkillElements['스피드 60'], '레어/상위', '녹딱', '스피드 60', true)));
    result_Final['녹딱'].push(...(await makeCompleteSkillData(passiveSkillElements['스피드 40'], '일반/하위', '녹딱', '스피드 40', true)));
    result_Final['녹딱'].push(...(await makeCompleteSkillData(passiveSkillElements['스피드 파워 60'], '레어/상위', '녹딱', '스피드 파워 60', true)));
    result_Final['녹딱'].push(...(await makeCompleteSkillData(passiveSkillElements['파워 60'], '레어/상위', '녹딱', '파워 60', true)));
    result_Final['녹딱'].push(...(await makeCompleteSkillData(passiveSkillElements['파워 40'], '일반/하위', '녹딱', '파워 40', true)));
    result_Final['녹딱'].push(...(await makeCompleteSkillData(passiveSkillElements['근성 60'], '레어/상위', '녹딱', '근성 60', true)));
    result_Final['녹딱'].push(...(await makeCompleteSkillData(passiveSkillElements['근성 40'], '일반/하위', '녹딱', '근성 40', true)));
    result_Final['녹딱'].push(...(await makeCompleteSkillData(passiveSkillElements['승부사'], '레어/상위', '녹딱')));
    result_Final['녹딱'].push(...(await makeCompleteSkillData(passiveSkillElements['모험심'], '일반/하위', '녹딱')));


    //logger(result_Final['녹딱']);
    //logger([...result_Final['녹딱'], ...result_Final['적성']]);
    //logger(`~녹딱 예상 횟수 : ${partCount.녹딱once + partCount.녹딱multi}, once : ${partCount.녹딱once}, multiple : ${partCount.녹딱multi}`);
    //logger(`~녹딱 실제 횟수 : ${currentSimulateCount}, once : ${currentOnceCount}, multiple : ${currentMultipleCount}`);


    //--------------------------------------------------일반기 마신 계산-------------------------------------------------------
    result_Final['일반기'] = [];


    //스킬 버튼 요소를 넣으면 마신차들 반환
    async function simulateSingleSkill(skillElement, once) {
        await toggleSkill(skillElement, true);
        const bashins = calcBashin(BASETIME, await simulate(once));
        await toggleSkill(skillElement, false);

        return bashins;
    }

    //스킬 버튼 요소를 넣으면 파생스킬(클구리 등)을 포함한 완전한 스킬 데이터 배열을 반환.
    async function makeCompleteSkillData(skillElement, rarity, category = '', custom_skillName = '', is777 = false) {
        const resultSkillDataArray = [];
        const skillId = getSkillIdByElement(skillElement);

        //유저가 선택한 스킬 스킵
        //유저가 선택한 스킬의 하위 스킬이면 스킵
        //유저가 선택한 고유기의 계승기면 스킵
        //유저가 선택한 계승기의 고유기면 스킵
        if (userSelected['전체 스킬 id'].includes(skillId) ||
            isLowerSkillOfUserSelected(skillId) ||
            userSelected['고유기 id'] === '1'+skillId.slice(1) ||
            (rarity === '계승' && checkUpperSkillandReturnLowerSkillElement(skillId)))
        { return resultSkillDataArray; }

        const skillName = custom_skillName ? custom_skillName : getProperSkillName(skillElement);
        //const skillDataArray = skillDB.filter(skillData => skillData['스킬 id'] === skillId);
        const skillDataArray = skillDB.binaryFilter('스킬 id', skillId);

        //임시
        //if (skillDataArray.length === 1) return resultSkillDataArray;

        //스킬DB에 없는 스킬이면 데이터 새로 만듦
        if (skillDataArray.length === 0) {
            const newSkillData = {
                '스킬 id' : skillId,
                '스킬명(한섭)' : skillName,
                '분류' : category
            };
            logger(`DB에 없는 스킬 : >${skillName}<`)
            skillDataArray.push(newSkillData);
        }

        //li element(고유기)면 진화스킬 계산
        if (isUniqueSkill(skillElement) && document.xpath(xpath['진화'])) {
            await toggleSkill(skillElement, true);
            for (const evolveElement of document.xpath(xpath['진화']).children) {
                //logger(`고유 스킬 : ${getProperSkillName(skillElement)} 진화 스킬 : ${getProperSkillName(evolveElement)}`)
                resultSkillDataArray.push(...(await makeCompleteSkillData(evolveElement, '진화')));
            }
        }

        //모든 파생스킬에 대해 계산
        for (const skillData of skillDataArray) {
            //회복기, 순수 미라클런, 순수 날아오르리 스킵
            if (skillData['스킵'] === 'TRUE') {continue;}

            //시뮬 기준으로 희귀도 지정
            skillData['희귀'] = rarity;
            if (custom_skillName) {skillData['스킬명(한섭)'] = skillName}

            //트리거가 적혀있으면 다 활성화
            let foundTriggerElements = []; //최종적으로 페이지에서 발견된 트리거들

            if (skillData['트리거 스킬 id']) {
                const triggerIdArray = splitTriggerText(skillData['트리거 스킬 id']);
                for (const array of triggerIdArray) {
                    let isFound = false;
                    for (const id of array) {
                        const triggerElement = getSkillElementById(id);
                        if (triggerElement) {
                            isFound = true;
                            foundTriggerElements.push(triggerElement);
                            break;
                        }
                    }
                    if (!isFound) {
                        //1차원 배열을 다 돌았는데 트리거 못찾음
                        console.error("트리거 못찾음", array)
                    }
                }

                //모든 array를 다 돌았는데 길이가 다르면 이 파생스킬은 건너뜀. 도주 아닐때 말괄량이 미라클런 등.
                if(triggerIdArray.length !== foundTriggerElements.length) {
                    continue;
                }

                //toggleSkills(foundTriggerElements, true);
            }
            const turnedOnArray = await toggleSkills(foundTriggerElements, true);
            const originalStatusArray = turnedOnArray.map(bool => !bool)

            //최속으로 바꿔야하는 경우(클구리) 최속으로 바꾸기
            if (skillData['최속'] === 'TRUE') {
                await randomPosition_Parent.childNodes[2].click();
            }

            //진화스킬이면 고유기 레벨 0
            if (rarity === '진화') {
                await (document.querySelector(selector['고유기 레벨']).__vue__.value = 0);
            }

            //카테고리가 지정되어 있으면 (ex.계승/일반) 그걸 사용, 아니면 (ex.고유) SkillDB 데이터를 그대로 사용.
            //if (category !== '') skillData['분류'] = category;

            //스킬 데이터에 즉발이라 되어있으면 한번, 랜덤 혹은 불명이면 n번
            // 777, U=ma2 등의 경우는 즉발이므로 한번.
            const once = (is777 || skillData['즉발'] === '즉발' || skillData['최속'] === 'TRUE' ? true : false);

            //하위 스킬을 유저가 활성화한 스킬일 경우, 하위 스킬을 끄고 시뮬 돌린뒤 다시 켜기
            const lowerSkillElement = checkUpperSkillandReturnLowerSkillElement(skillId);
            if (lowerSkillElement) { await toggleSkill(lowerSkillElement, false); }

            //시뮬
            const bashins = await simulateSingleSkill(skillElement, once);

            //기준 하위 스킬 다시 켜기
            if (lowerSkillElement) {
                await toggleSkill(lowerSkillElement, true);
                logger(`상위 스킬 : ${skillName} 유저 하위 스킬 : ${getProperSkillName(lowerSkillElement)} 마신 : ${bashins['평균']}`);
            }
            //트리거 다시 끄기
            await toggleSkills(foundTriggerElements, originalStatusArray);

            //최속으로 바꿨으면 다시 랜덤으로 돌리기
            if (skillData['최속'] === 'TRUE') {
                await randomPosition_Parent.childNodes[1].click()
            }

            //진화스킬이면 고유기 레벨 돌려놓기
            if (rarity === '진화') {
                await (document.querySelector(selector['고유기 레벨']).__vue__.value = userSelected['고유기 레벨']);
            }

            skillData['마신'] = bashins['평균'];
            skillData['표준 편차'] = bashins['표준 편차'];
            if (!once) {
                skillData['최대'] = bashins['최대'];
                skillData['중앙'] = bashins['중앙'];
                skillData['최소'] = bashins['최소'];
                addRatio(skillData, bashins);
                //logger(skillData);
            }

            resultSkillDataArray.push(skillData);
        }
        return resultSkillDataArray;
    }

    //배열용.
    async function makeCompleteSkillDatas(skillElements, rarity, category = '') {
        const result = [];
        for (const skillElement of skillElements) {
            result.push(...(await makeCompleteSkillData(skillElement, rarity, category)));
        }
        return result;
    }

    //고유기때 써먹으려고 분리
    let result_Inherit = [
        ...await makeCompleteSkillDatas(normalSkillElements['속도']['계승'], '계승', '속도'),
        ...await makeCompleteSkillDatas(normalSkillElements['가속']['계승'], '계승', '가속'),
        ...await makeCompleteSkillDatas(normalSkillElements['복합']['계승'], '계승', '복합')
    ];

    result_Final['일반기'] = [
        ...await makeCompleteSkillDatas(normalSkillElements['속도']['레어/상위'], '레어/상위', '속도'),
        ...await makeCompleteSkillDatas(normalSkillElements['속도']['일반/하위'], '일반/하위', '속도'),
        ...await makeCompleteSkillDatas(normalSkillElements['가속']['레어/상위'], '레어/상위', '가속'),
        ...await makeCompleteSkillDatas(normalSkillElements['가속']['일반/하위'], '일반/하위', '가속'),
        ...await makeCompleteSkillDatas(normalSkillElements['복합']['레어/상위'], '레어/상위', '복합'),
        ...await makeCompleteSkillDatas(normalSkillElements['복합']['일반/하위'], '일반/하위', '복합'),
        ...result_Inherit
    ];
    //logger(result_Final['일반기']);
    //logger(`~일반 예상 횟수 : ${partCount.일반once + partCount.일반multi}, once : ${partCount.일반once}, multiple : ${partCount.일반multi}`);
    //logger(`~일반 실제 횟수 : ${currentSimulateCount}, once : ${currentOnceCount}, multiple : ${currentMultipleCount}`);

    //--------------------------------------------------고유기 마신 계산-------------------------------------------------------
    result_Final['고유기'] = [];

    //고유기를 선택하지 않았을때만 계산
    if (!isUniqueSkillSelected) {
        result_Final['고유기'] = [
            ...await makeCompleteSkillDatas(unique_Skill_Elements, '고유')
        ];

        //다 끝났으니 고유기 없음 클릭
        await no_unique_skill_element.click();
    }
    //let prediction = makeSkillNamesArray(uniqueSkills['속가복']['3성']['요소 배열'])
    //let realResult = makeSkillNamesArray(unique_Skill_Elements)
    //logger(difference(prediction, realResult));
    //logger(`~고유 예상 횟수 : ${partCount.고유once + partCount.고유multi}, once : ${partCount.고유once}, multiple : ${partCount.고유multi}`);
    //logger(`~고유 실제 횟수 : ${currentSimulateCount}, once : ${currentOnceCount}, multiple : ${currentMultipleCount}`);

    //--------------------------------------------------마무리-------------------------------------------------------

    //전체 진행도 바 제거
    removeProgressBar(entire_progressbar);
    logger(`실제 시뮬 횟수 : ${currentSimulateCount}`)

    //logger(result_Final);
    //logger(skillDB);
    //logger(`예상 횟수 : ${totalSimulateCount}, once : ${onceCount + multipleCount * 5}, multiple : ${multipleCount * userSimulateCount}`);
    //logger(`실제 횟수 : ${currentSimulateCount}, once : ${currentOnceCount}, multiple : ${currentMultipleCount}`);

    let filename = `${userSelected['각질']} - ${userSelected['코스 장소']} ${userSelected['코스 종류 및 거리']} ${userSelected['코스 상태']}`;

    if (isUniqueSkillSelected) { filename += ` (고유 ${userSelected['고유기']})` }
    if (userSelected['계승/일반기'].length > 0) { filename += ` (일반 ${userSelected['계승/일반기'].join(', ')})` }

    let firstLine = `${userSelected['코스 장소']}\t${userSelected['마장']}\t${userSelected['거리']}\t${userSelected['거리 분류']}\t${userSelected['코스 상태']}\t${userSelected['각질']}\t${userSelected['스탯'].join('/')}\t${userSelected['거리 적성'].innerText}\t${userSelected['경기장 적성'].innerText}\t${userSelected['각질 적성']}\t${userSelected['컨디션']}\t${userSelected['고유기 레벨']}\t${userSimulateCount}\t${userSelected['내외']}`;

    firstLine += isUniqueSkillSelected ? `\t${userSelected['고유기']}` : '\t';
    firstLine += userSelected['계승/일반기'].length > 0 ? `\t${userSelected['계승/일반기'].join(', ')}` : '\t';
    firstLine += '\n\n';

    let result = [...result_Final['적성'],
                  ...result_Final['녹딱'],
                  ...result_Final['고유기'],
                  ...result_Final['일반기'],
                  //...result_Final['특수']
                 ];
    //logger(result);



    if(!isPredict) {
        downloadDictionaryArrayAsTSV(result, filename, firstLine);
    }

};


async function test() {
    //let skillDB_csv = await $.get("https://raw.githubusercontent.com/Ravenclaw5874/Auto-Bashin-Table-Generator/main/%EC%8A%A4%ED%82%ACDB%20-%202.5%EC%A3%BC%EB%85%84%20%EC%A0%84.csv");
    //let skillDB = $.csv.toObjects(skillDB_csv);
    async function print(skillName, rarity) {
        let skillData = skillDB.find(v => v['스킬명(한섭 시뮬)'] === skillName && v['희귀'] === rarity);
        return skillData;
    }
    let test1 = {};
    let test2 = {};
    test1 = await print('크리스마스 이브의 미라클 런!', '계승');
    logger(test1);
    test1['스킬명(한섭 시뮬)'] = '크리스마스 이브의 미라클 런!(1)';
    logger(skillDB);
    test2 = await print('크리스마스 이브의 미라클 런!', '계승');
    logger(test2);
    test2['스킬명(한섭 시뮬)'] = '크리스마스 이브의 미라클 런!(2)';
}

//진행도 계산하고 실제 main 실행
async function predict_main(current, all) {
    resetGlobalVariables()
    isPredict = true;
    await main(current, all);
    totalSimulateCount = currentSimulateCount;
    currentSimulateCount = 0;
    logger(`예상 시뮬 횟수 : ${totalSimulateCount}`);
    isPredict = false;
    await main(current, all);
    logger(`실제 시뮬 횟수 : ${currentSimulateCount}`)
}

async function filterStart(filterString) {
    await document.querySelector("#app > div.main-frame > form > div:nth-child(2) > div > div").click();
    await document.querySelector("#app > div.main-frame > form > div:nth-child(2) > div > div").click();

    let saved_Uma_NodeList_All = document.querySelectorAll("body > div:last-child > div:nth-child(1) > div:nth-child(1) > ul > li.el-select-dropdown__item");
    let saved_Uma_NodeList = [];

    //챔미 필터링
    for (let i = 0; i < saved_Uma_NodeList_All.length; i++) {
        if (filterString !== '' && saved_Uma_NodeList_All[i].innerText.includes(filterString)) {
            saved_Uma_NodeList.push(saved_Uma_NodeList_All[i]);
        }
    }

    //스킬DB 가져오기
    //tampermonkey resource의 업데이트 주기 기본설정이 "안함"이어서 업데이트가 안됨. jquery로 가져오자.
    const skillDB_tsv = await $.get("https://raw.githubusercontent.com/Ravenclaw5874/Auto-Bashin-Table-Generator/main/%EC%8A%A4%ED%82%ACDB%20-%202.5%EC%A3%BC%EB%85%84%20%EC%A0%84.tsv");
    skillDB = tsvToDictionaryArray(skillDB_tsv);
    //skillDB = tsvToDictionaryArray(GM_getResourceText("skillDBTsv"));
    logger(skillDB);

    //아무것도 없으면 현재 상태로 그냥 시뮬
    if (saved_Uma_NodeList.length === 0) {
        await main(1, 1);
    }

    else {
        //있으면 모든 프리셋에 대해 마신표 제작
        for (let i = 0; i < saved_Uma_NodeList.length; i++) {
            await saved_Uma_NodeList[i].click();
            await document.querySelector("#app > div.main-frame > form > div:nth-child(3) > div > button").click();//불러오기

            await main(i + 1, saved_Uma_NodeList.length);
        }
    }
}

function createNode() {
    //필터 칸 생성
    let filterInput = document.querySelector("#app > div.main-frame > form > div:nth-child(8)").cloneNode(true);
    let filterNode = filterInput.querySelector("div > div > input");
    filterNode.setAttribute("placeholder", "필터");
    //filterInput.firstChild.innerText = "배";
    //filterInput.appendChild(filterInput.firstChild.cloneNode(true));
    filterInput.removeChild(filterInput.firstChild);

    //버튼 생성
    let button = document.createElement("button");
    button.setAttribute("class", "el-button el-button--success");
    button.innerText = "마신표 제작 시작";
    button.onclick = () => {
        let filterString = filterNode.value;
        filterStart(filterString);
    };

    let button2 = document.createElement("button");
    button2.setAttribute("class", "el-button el-button--default");
    button2.innerText = "테스트";
    button2.onclick = () => {
        test();
    };

    //부모 생성
    let div = document.createElement("div");
    div.setAttribute("class", "el-form-item");
    div.appendChild(filterInput);
    div.appendChild(button);

    return div;
}

function checkURL() {
    //if ( ! /#\/champions-meeting.*/.test(location.hash) ) return;
    if (!location.hash.includes("champions-meeting")) return;
    document.querySelector("#app > div.main-frame > form").appendChild(createNode());
    //document.querySelector("#app > div.main-frame > form").appendChild(button2);

}

checkURL();

