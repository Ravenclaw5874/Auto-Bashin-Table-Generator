// ==UserScript==
// @name         우마무스메 자동 마신표 제작기
// @namespace    http://tampermonkey.net/
// @version      2.2.5
// @description  우마무스메 레이스 에뮬레이터로 마신표를 자동으로 만드는 스크립트입니다.
// @author       Ravenclaw5874
// @match        http://race-ko.wf-calc.net/
// @match        http://localhost:8080/
// @icon         https://img1.daumcdn.net/thumb/C151x151/?fname=https%3A%2F%2Ft1.daumcdn.net%2Fcafeattach%2F1ZK1D%2F80ed3bb76fa6ce0a4a0c7a9cc33d55430f797e35
// @grant        none
// @require      http://code.jquery.com/jquery-3.6.1.min.js
// @require      https://raw.githubusercontent.com/evanplaice/jquery-csv/main/src/jquery.csv.js
// @license      MIT License
// ==/UserScript==

/*----업데이트 로그------
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


//Xpath로 요소 찾기
// JS path : document.querySelector("#el-collapse-content-2170 > div > div:nth-child(1) > div") 이런식으로 접속할때 마다 바뀌는 4자리 숫자가 붙음.
function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

//현재 요소가 몇번째 자식인지 알려줌.
function getIndex(element) {
    for (let i = 0; i < element.parentNode.childNodes.length; i++) {
        if (element.parentNode.childNodes[i] === element) {
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
            selectors.forEach((selector) => {
                document.querySelector(selector).click();
            });
            break;
            //노드 리스트일 경우
        case 'object':
            for (let i = 0; i < selectors.length; i++) {
                await selectors[i].click();
            }
            break;
    }
}

//시뮬레이트 버튼을 클릭하고 끝나면 결과를 반환
function simulate(once/*, isMulti = false*/) {
    return new Promise(async resolve => {
        //n회 시행시 각 시행의 결과를 모두 저장할 배열
        let eachTimes = [];

        //테이블만 감시하면 999회 -> 1000회에서 테이블이 변하지 않았을 경우 멈춰버려서 전체를 감시. 2개를 따로 감시하면 한 변화에 두번 실행됨.
        let target = document.querySelector("#app > div.main-frame");// > div:nth-child(5) > table:nth-child(2)");
        let option = { characterData: true, subtree: true };

        //시뮬 종료를 감지할 진행도 바
        let progress = document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div.el-dialog__wrapper > div > div.el-dialog__body > div");

        //감시자 동작 설정
        let observer = new MutationObserver(async (mutations) => {
            //매 시뮬마다 "마지막 시뮬레이션 결과 상세(2:31.93)" 의 2:31.93을 추출해서 eachTimes에 저장
            let extractedText = extractTextBeside(document.querySelector("#app > div.main-frame > h3").innerText, '(', ')');
            if (extractedText !== '-') { eachTimes.push(convertToSec(extractedText)); }

            //시뮬레이션 끝나면
            if (progress.ariaValueNow === "100") {
                logger(`총 ${eachTimes.length}회`);
                //감시자 제거
                observer.disconnect();

                let average = convertToSec(document.querySelector("#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(2)").innerText);
                //let SD = document.querySelector("#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(3)").innerText
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
                    randomPosition_Results[0] = convertToSec(document.querySelector("#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(4)").innerText);
                    randomPosition_Results[1] = convertToSec(document.querySelector("#app > div.main-frame > div > table:nth-child(2) > tr:nth-child(2) > td:nth-child(5)").innerText);

                    //스킬 발동 구간 드롭다운 메뉴를 클릭해서 최하위로 보낸뒤 주소 가져옴.
                    await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(5) > div > div").click();
                    let randomPosition_Parent = document.querySelector("body > div.el-select-dropdown.el-popper:last-child > div > div > ul");

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
                    //'표준편차': SD,
                    '타임 배열': eachTimes
                }
                resolve(result);
            }
        });

        //감시자 생성
        observer.observe(target, option);

        (once ?
         await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(3) > div > button").click() ://한번 시뮬
         await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(1) > div > button").click());//n번 시뮬

        document.querySelector("body > div.v-modal").remove();
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
        //result['표준편차'] = (times['표준편차'] * 10).toFixed(2) * 1;

        //const flooredBasetime = Math.floor(BASETIME * 100) / 100;
        result['마신 배열'] = times['타임 배열'].map(time => ((BASETIME - time) * 10).toFixed(2) * 1);
        result['중앙'] = calculateMedian(result['마신 배열']).toFixed(2) * 1;
        return result;
    }
}

//텍스트의 양옆 공백 제거 및 ○ -> ◯ 변환(큰원으로)
function getProperSkillName(skillElement) {
    return skillElement.innerText.trimStart().trimEnd();//.replace('○', '◯');
}

//스킬 노드 배열 넣으면 이름 배열 반환
function makeSkillNamesArray(skillElements) {
    let result = [];
    skillElements.forEach((node) => { result.push(getProperSkillName(node)); });
    return result;
}

//전체 진행도 바 생성
function createProgressBar(current, all) {
    let original = document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div.el-dialog__wrapper > div > div.el-dialog__body > div");
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

let previousTime = performance.now();
let previousCount = 0;

//전체 진행도 바 업데이트
function updateProgressBar(currentSimulateCount, totalSimulateCount) {
    const elapsedCount = currentSimulateCount - previousCount;
    const remainCount = totalSimulateCount - currentSimulateCount;
    const percent = parseInt(currentSimulateCount / totalSimulateCount * 100)

    entire_progressbar.ariaValueNow = percent;
    entire_progressbar.querySelector("div.el-progress-bar > div > div").setAttribute("style", `width: ${percent}%`);
    entire_progressbar.querySelector("div.el-progress__text").innerText = `${percent}%`;

    if (elapsedCount > userSimulateCount || remainCount < userSimulateCount) {
        const currentTime = performance.now()
        const elapsedTime = currentTime - previousTime;
        const remainTime = remainCount / elapsedCount * elapsedTime; //밀리초
        //logger(`경과 ${elapsedTime}밀리초 경과수 ${elapsedCount}개 앞으로 ${remainTime}밀리초 앞으로 ${remainCount}개`);
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
        await skillElement.parentElement.childNodes[1].click()
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

let entire_progressbar; //전체 진행 바 요소

function resetGlobalVariables() {
    userSimulateCount = 0; //유저가 설정한 시뮬 횟수
    totalSimulateCount = 0; //계산된 총 시뮬 횟수
    currentSimulateCount = 0; //현재 누적 시뮬 횟수
    currentOnceCount = 0;
    currentMultipleCount = 0;
    previousTime = performance.now();
    previousCount = 0;
}

//로그 on/off용
const isLoggerOn = false;

function logger(content) {
    if (isLoggerOn) {
        switch (typeof (content)) {
            case 'object':
                console.table(content);
                break;
            default:
                console.log(content);
                break;
        }
    }
}



//마신표 제작 시작 버튼을 누르면 실행됨.
var main = async function (current, all) {
    'use strict';
    // Your code here...


    //--------------------------------------------------값 읽어오기-------------------------------------------------------
    resetGlobalVariables()

    //스킬 DB 불러오기
    //let skillDB_csv = await $.get("https://raw.githubusercontent.com/Ravenclaw5874/Auto-Bashin-Table-Generator/main/%EC%8A%A4%ED%82%ACDB%20-%201%EC%A3%BC%EB%85%84~.csv");
    let skillDB_csv = await $.get("https://raw.githubusercontent.com/Ravenclaw5874/Auto-Bashin-Table-Generator/main/%EC%8A%A4%ED%82%ACDB%20-%201.5%EC%A3%BC%EB%85%84%20%EC%A0%84.csv");
    const skillDB = $.csv.toObjects(skillDB_csv);
    //logger(skillDB);

    //시뮬 횟수 얼만지 가져오기
    userSimulateCount = Number(document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(2) > div > div > div > input").ariaValueNow);

    //전체 난수 고정 선택
    await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(4) > div > div > div").click();
    await document.querySelector("body > div.el-select-dropdown.el-popper:last-child > div > div > ul > li:nth-child(3)").click();
    //let skill_invoke_rate_bonus = document.querySelectorAll("body > div.el-select-dropdown.el-popper");
    //await skill_invoke_rate_bonus[skill_invoke_rate_bonus.length-1].querySelector("div > div > ul > li:nth-child(3)").click();

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
        '스탯': [document.querySelector("#app > div.main-frame > form > div:nth-child(8) > div > div > input").value,
               document.querySelector("#app > div.main-frame > form > div:nth-child(9) > div > div > input").value,
               document.querySelector("#app > div.main-frame > form > div:nth-child(10) > div > div > input").value,
               document.querySelector("#app > div.main-frame > form > div:nth-child(11) > div > div > input").value,
               document.querySelector("#app > div.main-frame > form > div:nth-child(12) > div > div > input").value],
        '고유기 레벨': document.querySelector("#app > div.main-frame > form > div:nth-child(24) > div > div > div > input").ariaValueNow,
        '전체 스킬': [], //유저가 선택한 전체 고유기 계승기 일반기 '이름' 저장용
        '고유기': '',
        '계승/일반기': [], //유저가 선택한 계승기 일반기 '이름' 저장용
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
    Array.from($("#app > div.main-frame > form > div.el-collapse").find("label.el-checkbox-button.is-checked")).forEach((e) => {
        userSelected['계승/일반기'].push(getProperSkillName(e));
    });
    userSelected['전체 스킬'].push(...userSelected['계승/일반기']); //내용물 '복사'

    //유저가 고유기를 선택했는가?
    let isUniqueSkillSelected = false;
    let userSelectedUniqueSkill = dropDownParent['고유기'].querySelector("ul > li.el-select-dropdown__item.selected");
    // 선택된 고유기가 있고, 그게 없음/발동 안함이 아니면
    if (userSelectedUniqueSkill !== null && userSelectedUniqueSkill !== dropDownParent['고유기'].childNodes[1]) {
        isUniqueSkillSelected = true;
        userSelected['전체 스킬'].push(getProperSkillName(userSelectedUniqueSkill));
        userSelected['고유기'] = getProperSkillName(userSelectedUniqueSkill);
    }

    //logger("작전: " + userSelected['각질']);
    //logger("적성: " + userSelected['거리 적성'].innerText + " " + userSelected['경기장 적성'].innerText + " " + userSelected['각질 적성']);
    //logger("컨디션: " + userSelected['컨디션']);
    //logger("코스: " + userSelected['코스 장소'] + " " + userSelected['코스 종류 및 거리'] + " " + userSelected['코스 상태']);

    await clickElements(simulateOptionSelectors); //드롭다운 전부 닫기

    function findMatches(elements, matchText) {
        let matchedElements = [];
        elements.forEach(e => {
            if (e.nodeType === 1 && e.matches(matchText)) {
                matchedElements.push(e);
            }
        });
        return matchedElements;
    }


    //계승 포함 전체 일반기들
    let normalSkillElements = {
        '속도': {
            '레어/상위': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[3]/div[2]/div/div[1]/div").childNodes,
            '일반/하위': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[3]/div[2]/div/div[2]/div").childNodes,
            '계승': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[3]/div[2]/div/div[3]/div").childNodes
        },
        '가속': {
            '레어/상위': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[4]/div[2]/div/div[1]/div").childNodes,
            '일반/하위': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[4]/div[2]/div/div[2]/div").childNodes,
            '계승': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[4]/div[2]/div/div[3]/div").childNodes
        },
        '복합': {
            '레어/상위': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[5]/div[2]/div/div[1]/div").childNodes,
            '일반/하위': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[5]/div[2]/div/div[2]/div").childNodes,
            '계승': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[5]/div[2]/div/div[3]/div").childNodes
        }
    };

    //유저가 선택한 {일반기, 요소, 상위 스킬 이름 배열}을 저장할 사전 배열
    let normalRareMap = [];
    let userSelectedNormalSkillElements = [
        ...Array.from(normalSkillElements['속도']['레어/상위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['속도']['일반/하위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['가속']['레어/상위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['가속']['일반/하위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['복합']['레어/상위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked")),
        ...Array.from(normalSkillElements['복합']['일반/하위']).filter(e => e.nodeType === 1 && e.matches("label.el-checkbox-button.is-checked"))
    ];
    userSelectedNormalSkillElements.forEach(e => {
        let skillName = getProperSkillName(e)
        let skillData = skillDB.find(v => v['스킬명(한섭 시뮬)'] === skillName);
        let upperSkillNameArray = skillDB.filter(v => v['그룹'] === skillData['그룹'] && v['단계'] > skillData['단계']).map(v => v['스킬명(한섭 시뮬)']);
        let lowerSkillNameArray = skillDB.filter(v => v['그룹'] === skillData['그룹'] && v['단계'] < skillData['단계']).map(v => v['스킬명(한섭 시뮬)']);

        normalRareMap.push({
            '스킬 이름': skillName,
            '스킬 요소': e,
            '상위 스킬 이름 배열': upperSkillNameArray,
            '하위 스킬 이름 배열': lowerSkillNameArray
        });
    });

    //스킬이 유저가 선택한 스킬의 상위 스킬인지 확인하고 맞다면 하위 스킬의 요소를 반환
    function checkUpperSkillandReturnLowerSkillElement(upperSkillName) {
        //normalRareMap.forEach(d => { d['상위 스킬 이름 배열'].includes(upperSkillName) })
        for (let i = 0; i < normalRareMap.length; i++) {
            if (normalRareMap[i]['상위 스킬 이름 배열'].includes(upperSkillName)) {
                return normalRareMap[i]['스킬 요소'];
            }
        }
        return false;
    }

    function isLowerSkillOfUserSelected(lowerSkillName) {
        for (let i = 0; i < normalRareMap.length; i++) {
            if (normalRareMap[i]['하위 스킬 이름 배열'].includes(lowerSkillName)) {
                return true;
            }
        }
        return false;
    }

    //고유기들
    let uniqueSkills = {
        '회복': {
            '2성': {
                '요소 배열': [],
                '이름 배열': ['클리어 하트', '두근두근 준비 땅!']
            },
            '3성': {
                '요소 배열': [],
                '이름 배열': makeSkillNamesArray(getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[2]/div[2]/div/div[3]/div").childNodes)
            }
        },
        '속가복': {
            /*'2성': {
                '요소 배열': [],
                '이름 배열': []
            },*/
            '3성': {
                '요소 배열': [],
                '이름 배열': [
                    ...makeSkillNamesArray(normalSkillElements['속도']['계승']),
                    ...makeSkillNamesArray(normalSkillElements['가속']['계승']),
                    ...makeSkillNamesArray(normalSkillElements['복합']['계승'])
                ]
            }
        },
    }

    //타키온 고유기가 회복기면 제거할 대상에 2성 고유기 추가.
    if (uniqueSkills['회복']['3성']['이름 배열'].includes('U=ma2')) {
        uniqueSkills['회복']['2성']['이름 배열'].push('introduction：My body');
    }

    //전체 고유기
    let unique_Skill_Elements = dropDownParent['고유기'].childNodes;
    unique_Skill_Elements = Array.prototype.slice.call(unique_Skill_Elements); //NodeList -> 배열로 변환
    unique_Skill_Elements.shift(); //첫번재 요소 ( <!----> ) 제거

    //제거할 스킬명들
    let needToDelete_SkillNames = ['없음／발동 안 함',
                                   '없음／발동하지 않음',
                                   'なし／発動しない',
                                   ...uniqueSkills['회복']['3성']['이름 배열'],
                                   ...uniqueSkills['회복']['2성']['이름 배열']];

    //전체 속/가/복 고유기 '요소'들.
    let notHeal_unique_Skill_Elements = unique_Skill_Elements.filter(x => !needToDelete_SkillNames.includes(getProperSkillName(x)));
    uniqueSkills['속가복']['3성']['요소 배열'] = notHeal_unique_Skill_Elements;
    //2성 속/가/복 고유기 '요소'들
    //uniqueSkills['속가복']['2성']['요소 배열'] = notHeal_unique_Skill_Elements.filter(x => !uniqueSkills['속가복']['3성']['이름 배열'].includes(getProperSkillName(x)));
    //3성 속/가/복 고유기 '요소'들.
    //uniqueSkills['속가복']['3성']['요소 배열'] = notHeal_unique_Skill_Elements.filter(x => uniqueSkills['속가복']['3성']['이름 배열'].includes(getProperSkillName(x)));



    //--------------------------------------------------진행도용 전체 시뮬 횟수 계산-------------------------------------------------------
    let result_Final = {};

    //유저가 선택한 적성 인덱스
    let index_dist = getIndex(userSelected['거리 적성']);
    let index_surf = getIndex(userSelected['경기장 적성']);

    //전체 시뮬 횟수 계산
    let onceCount = 0; //즉발
    let multipleCount = 0; //랜덤
    let partCount = {}; //구간별 예상치 기록용

    onceCount += 1; //기준 타임 계산. simulate 함수에서 실제 카운트를 계산하므로, 포함해야 정확한 %가 나옴.
    onceCount += (index_dist === 1 ? 2 : index_dist) * (index_surf === 1 ? 2 : index_surf); //적성
    partCount.적성once = onceCount + multipleCount * 5;
    partCount.적성multi = multipleCount * userSimulateCount;

    onceCount += 8; //녹딱
    multipleCount += 2; //승부사, 모험심
    partCount.녹딱once = onceCount + multipleCount * 5;
    partCount.녹딱multi = multipleCount * userSimulateCount;




    //모든 계승/일반 스킬 요소들
    let allSkill_Elements = [
        ...normalSkillElements['속도']['레어/상위'],
        ...normalSkillElements['속도']['일반/하위'],
        ...normalSkillElements['가속']['레어/상위'],
        ...normalSkillElements['가속']['일반/하위'],
        ...normalSkillElements['복합']['레어/상위'],
        ...normalSkillElements['복합']['일반/하위'],
        ...normalSkillElements['속도']['계승'],
        ...normalSkillElements['가속']['계승'],
        ...normalSkillElements['복합']['계승']
    ]

    //유저가 고유기를 선택하지 않았으면 회복기 제외 고유기 추가
    /*if (!isUniqueSkillSelected) {
        allSkill_Elements.push(...uniqueSkills['속가복']['2성']['요소 배열']);
        allSkill_Elements.push(...uniqueSkills['속가복']['3성']['요소 배열']);
    }*/

    //차집합 함수
    function difference(arr1, arr2) {
        return arr1.filter(x => !arr2.includes(x));
    }

    //전체 스킬에서 유저가 선택한 스킬 빼기
    let allSkills = makeSkillNamesArray(allSkill_Elements);
    allSkills = difference(allSkills, userSelected['전체 스킬']);
    //logger(allSkills);

    allSkills.forEach((skillName) => {
        let skillData = skillDB.find(v => v['스킬명(한섭 시뮬)'] === skillName && (v['희귀'] === '계승' || v['희귀'] === '레어/상위' || v['희귀'] === '일반/하위'));
        if (typeof (skillData) === 'undefined') {
            multipleCount += 1;
            return;
        }
        //else if (skipList_forCount.includes(skillName)) {return;}
        /*else if (skillData['즉발'] === '특수') {return;}
            else (skillData['즉발'] === '즉발'? onceCount+=1: multipleCount+=1);*/
        switch (skillData['즉발']) {
            case '특수':
                break;
            case '즉발':
                onceCount += 1;
                break;
            case '랜덤':
                multipleCount += 1;
                break;
        }
    });
    partCount.일반once = onceCount + multipleCount * 5;
    partCount.일반multi = multipleCount * userSimulateCount;

    //고유기
    if (!isUniqueSkillSelected) {
        let uniques = makeSkillNamesArray(uniqueSkills['속가복']['3성']['요소 배열']);
        uniques = difference(uniques, userSelected['전체 스킬']);

        //let special_predict = 0;
        //let immedi_predict = 0;
        //let random_predict = 0;

        uniques.forEach((skillName) => {
            let skillData = skillDB.find(v => v['스킬명(한섭 시뮬)'] === skillName && v['희귀'] === '고유');
            if (typeof (skillData) === 'undefined') {
                multipleCount += 1;
                return;
            }
            //else if (skipList_forCount.includes(skillName)) {return;}
            /*else if (skillData['즉발'] === '특수') {return;}
                else (skillData['즉발'] === '즉발'? onceCount+=1: multipleCount+=1);*/
            switch (skillData['즉발']) {
                case '특수':
                    break;
                case '즉발':
                    onceCount += 1;
                    break;
                case '랜덤':
                    multipleCount += 1;
                    break;
            }
        });
        partCount.고유once = onceCount + multipleCount * 5;
        partCount.고유multi = multipleCount * userSimulateCount;
    }

    //특수 : 클구리, 수루젠, 축마모, 리키, 총스페, 꼬올, 꼬솟, 명경, 또생
    //클구리
    onceCount += (isUniqueSkillSelected ? 3 : 6); //777, uma2, 두근두근
    if (userSelected['각질'] === '추입') { onceCount += (isUniqueSkillSelected ? 1 : 2); } //하굣길
    if (userSelected['각질'] === '도주') { onceCount += (isUniqueSkillSelected ? 1 : 2); } //말괄량이

    //수루젠
    onceCount += (isUniqueSkillSelected ? 2 : 4); //777, uma2
    multipleCount += (isUniqueSkillSelected ? 1 : 2);
    //불벼락
    multipleCount += (isUniqueSkillSelected ? 1 : 2);
    //리키
    multipleCount += (isUniqueSkillSelected ? 0 : 4);
    //총스페
    if (userSelected['코스 장소'] === '나카야마') { onceCount += (isUniqueSkillSelected ? 1 : 2); }
    else { onceCount += (isUniqueSkillSelected ? 0 : 1); }
    //꼬올, 꼬솟
    multipleCount += 2;
    //명경, 또생 (astar)
    if (userSelected['마장'] === '더트') { onceCount += 4; }

    partCount.특수once = onceCount + multipleCount * 5;
    partCount.특수multi = multipleCount * userSimulateCount;

    totalSimulateCount = onceCount + multipleCount * (userSimulateCount + 5); //랜덤 스킬은 스킬 구간별 5회 추가됨.
    //logger(`예상 횟수 : ${totalSimulateCount}, once : ${onceCount + multipleCount * 5}, multiple : ${multipleCount*userSimulateCount}`);


    //진행도 바 활성화를 위한 한번 시뮬
    await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(3) > div > button").click();

    //전체 진행도 바 생성
    entire_progressbar = createProgressBar(current, all);
    updateProgressBar(currentSimulateCount, totalSimulateCount);


    //--------------------------------------------------마신 계산 시작-------------------------------------------------------

    //기준 타임 계산
    //let basetimes = await simulate(true);
    let BASETIME = (await simulate(true))['평균'];
    logger('기준 타임: ' + BASETIME);

    //--------------------------------------------------적성 마신 계산-------------------------------------------------------
    result_Final['적성'] = [];

    //거리S 경기장S로 돌려도 비교를 위해 최소 AA까지는 시뮬.
    for (let i = 1; i <= (index_dist === 1 ? 2 : index_dist); i++) {
        for (let j = 1; j <= (index_surf === 1 ? 2 : index_surf); j++) {
            //logger(dropDownParent['거리 적성'].childNodes[i].innerText + " " + dropDownParent['경기장 적성'].childNodes[j].innerText);
            await dropDownParent['거리 적성'].childNodes[i].click();
            await dropDownParent['경기장 적성'].childNodes[j].click();

            let row = {
                '희귀': '적성',
                '분류': '적성',
                '마신': calcBashin(BASETIME, await simulate(true))['평균'],
                '스킬명(한섭 시뮬)': userSelected['거리 분류'] + dropDownParent['거리 적성'].childNodes[i].innerText + ' ' + userSelected['마장'] + dropDownParent['경기장 적성'].childNodes[j].innerText,
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
    logger(`~적성 예상 횟수 : ${partCount.적성once + partCount.적성multi}, once : ${partCount.적성once}, multiple : ${partCount.적성multi}`);
    logger(`~적성 실제 횟수 : ${currentSimulateCount}, once : ${currentOnceCount}, multiple : ${currentMultipleCount}`);


    //--------------------------------------------------녹딱 마신 계산-------------------------------------------------------
    result_Final['녹딱'] = [];

    let passiveParents = {
        '상위': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[1]/div"),
        '하위': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[2]/div")
    };
    let passiveSkillElements = {
        '스피드 80': passiveParents['상위'].querySelector("input[value='4']").parentElement, //단독◎
        '스피드 60': passiveParents['상위'].querySelector("input[value='5']").parentElement, //복병◎
        '스피드 40': passiveParents['하위'].querySelector("input[value='4']").parentElement, //복병○
        '스피드 파워 60': passiveParents['상위'].querySelector("input[value='40']").parentElement, //첫 봄바람
        '파워 60': passiveParents['상위'].querySelector("input[value='22']").parentElement, //대항의식◎
        '파워 40': passiveParents['하위'].querySelector("input[value='23']").parentElement, //대항의식○
        '근성 60': passiveParents['상위'].querySelector("input[value='24']").parentElement, //집중마크◎
        '근성 40': passiveParents['하위'].querySelector("input[value='25']").parentElement, //집중마크○
        '승부사': passiveParents['상위'].querySelector("input[value='52']").parentElement, //승부사
        '모험심': passiveParents['하위'].querySelector("input[value='49']").parentElement, //모험심

    };

    /*let speed_rare = getElementByXpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[1]/div/label[3]/span');
        let power_rare = getElementByXpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[1]/div/label[9]/span');
        let speed_normal = getElementByXpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[2]/div/label[3]/span');
        let power_normal = getElementByXpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[2]/div/label[11]/span');


        result_Final['녹딱'][0] = await makeCompleteSkillData(speed_rare, '레어/상위', '녹딱', '스피드◎');
        result_Final['녹딱'][1] = await makeCompleteSkillData(power_rare, '레어/상위', '녹딱', '파워◎');
        result_Final['녹딱'][2] = await makeCompleteSkillData(speed_normal, '일반/하위', '녹딱', '스피드◯');
        result_Final['녹딱'][3] = await makeCompleteSkillData(power_normal, '일반/하위', '녹딱', '파워◯');*/

    result_Final['녹딱'].push(await makeCompleteSkillData(passiveSkillElements['스피드 80'], '레어/상위', '녹딱', '스피드 80'));
    result_Final['녹딱'].push(await makeCompleteSkillData(passiveSkillElements['스피드 60'], '레어/상위', '녹딱', '스피드 60'));
    result_Final['녹딱'].push(await makeCompleteSkillData(passiveSkillElements['스피드 40'], '일반/하위', '녹딱', '스피드 40'));
    result_Final['녹딱'].push(await makeCompleteSkillData(passiveSkillElements['스피드 파워 60'], '레어/상위', '녹딱', '스피드 파워 60'));
    result_Final['녹딱'].push(await makeCompleteSkillData(passiveSkillElements['파워 60'], '레어/상위', '녹딱', '파워 60'));
    result_Final['녹딱'].push(await makeCompleteSkillData(passiveSkillElements['파워 40'], '일반/하위', '녹딱', '파워 40'));
    result_Final['녹딱'].push(await makeCompleteSkillData(passiveSkillElements['근성 60'], '레어/상위', '녹딱', '근성 60'));
    result_Final['녹딱'].push(await makeCompleteSkillData(passiveSkillElements['근성 40'], '일반/하위', '녹딱', '근성 40'));
    result_Final['녹딱'].push(await makeCompleteSkillData(passiveSkillElements['승부사'], '레어/상위', '녹딱', '승부사'));
    result_Final['녹딱'].push(await makeCompleteSkillData(passiveSkillElements['모험심'], '일반/하위', '녹딱', '모험심'));


    //logger(result_Final['녹딱']);
    //logger([...result_Final['녹딱'], ...result_Final['적성']]);
    logger(`~녹딱 예상 횟수 : ${partCount.녹딱once + partCount.녹딱multi}, once : ${partCount.녹딱once}, multiple : ${partCount.녹딱multi}`);
    logger(`~녹딱 실제 횟수 : ${currentSimulateCount}, once : ${currentOnceCount}, multiple : ${currentMultipleCount}`);


    //--------------------------------------------------일반기 마신 계산-------------------------------------------------------
    result_Final['일반기'] = [];


    //스킬 버튼 요소를 넣으면 마신차들 반환
    async function simulateSingleSkill(skillElement, once) {
        //await skillElement.click();
        await toggleSkill(skillElement, true);
        let bashins = calcBashin(BASETIME, await simulate(once));
        //await skillElement.click();
        await toggleSkill(skillElement, false);

        return bashins;
    }

    //스킬 버튼 요소를 넣으면 마신차를 포함한 완전한 스킬 데이터를 반환.
    async function makeCompleteSkillData(skillElement, rarity, category = '', skillName, is777 = false) {
        let skillData = skillDB.find(v => v['스킬명(한섭 시뮬)'] === skillName && v['희귀'] === rarity);

        //스킬DB에 없는 스킬이면 데이터 새로 만듦
        if (typeof(skillData) === 'undefined') {
            logger(`DB에 없는 스킬 : >${skillName}<`)
            skillData = {};
            skillData['스킬명(한섭 시뮬)'] = skillName;
            //스킬DB에 없는 스킬이면 시뮬 상의 분류를 사용.
            skillData['분류'] = category;
        }

        //시뮬 기준으로 희귀도 지정
        skillData['희귀'] = rarity;

        //카테고리가 지정되어 있으면 (ex.계승/일반) 그걸 사용, 아니면 (ex.고유) SkillDB 데이터를 그대로 사용.
        //if (category !== '') skillData['분류'] = category;

        //스킬 데이터에 즉발이라 되어있으면 한번, 랜덤 혹은 불명이면 n번
        // 777, U=ma2 등의 경우는 즉발이므로 한번.
        let once = (is777 || skillData['즉발'] === '즉발' ? true : false);

        //하위 스킬을 유저가 활성화한 스킬일 경우, 하위 스킬을 끄고 시뮬 돌린뒤 다시 켜기
        let lowerSkillElement = checkUpperSkillandReturnLowerSkillElement(skillName);
        if (lowerSkillElement) { toggleSkill(lowerSkillElement, false); }

        let bashins = await simulateSingleSkill(skillElement, once);

        if (lowerSkillElement) {
            toggleSkill(lowerSkillElement, true);
            logger(`상위 스킬 : ${skillName} 유저 하위 스킬 : ${getProperSkillName(lowerSkillElement)} 마신 : ${bashins['평균']}`);
        }

        skillData['마신'] = bashins['평균'];
        //skillData['표준편차'] = bashins['표준편차'];
        if (!once) {
            skillData['최대'] = bashins['최대'];
            skillData['중앙'] = bashins['중앙'];
            skillData['최소'] = bashins['최소'];
            addRatio(skillData, bashins);
            //logger(skillData);
        }

        return skillData;
    }

    //최대 마신을 구해서 (5.83) 0.5 구간으로 나눈다음 (0.5, 1.0, 1.5... 5.5) 그 값 이상인 비율을 skillData에 넣어줌.
    function addRatio(skillData, bashins) {
        const quotient = Math.floor(bashins['최대'] / 0.5)
        const maxDot5 = quotient * 0.5;

        for (let i = 1; i <= quotient; i++) {
            const keyString = `≥${0.5 * i}`
            const ratio = (bashins['마신 배열'].filter(bashin => bashin >= 0.5 * i).length / bashins['마신 배열'].length).toFixed(2) * 1;
            skillData[keyString] = ratio;
            //logger(skillData);
        }
    }

    //스킵한 스킬 요소 저장용.
    let skipped_Skill_Elements = [];
    //클구리, 수르젠, 꼬올은 나중에 따로 계산
    /*let skipList = ['크리스마스 이브의 미라클 런!', '뭉클하게♪Chu', '꼬리의 폭포오르기', '꼬리 올리기',
                        '聖夜のミラクルラン！', 'グッときて♪Chu', '尻尾の滝登り', '尻尾上がり',
                        '지고의 다운힐러', '내리막 달인', '등산가', '직활강', '결의의 직활강', '십만 마력', '백만 마력'];*/

    //배열용.
    async function makeCompleteSkillDatas(skillElements, rarity, category = '') {
        let result = [];
        for (let i = 0; i < skillElements.length; i++) {
            let skillName = getProperSkillName(skillElements[i])
            let skillData = skillDB.find(v => v['스킬명(한섭 시뮬)'] === skillName && v['희귀'] === rarity);

            //계산하지 않을 스킬 스킵
            if (userSelected['전체 스킬'].includes(skillName)) {
                continue;
            }

            //유저가 선택한 스킬의 하위 스킬이면 스킵
            if (isLowerSkillOfUserSelected(skillName)) {
                continue;
            }
            //나중에 계산할 스킬 스킵
            /*else if (skipList.includes(getProperSkillName(skillElements[i]))) {
                    skipped_Skill_Elements.push(skillElements[i]);
                    continue;
                }*/
            //스킬 데이터가 있고, 특수면 스킵
            else if (typeof (skillData) !== 'undefined' && skillData['즉발'] === '특수') {
                skipped_Skill_Elements.push(skillElements[i]);
                continue;
            }
            //그 외에는 계산
            else {
                result.push(await makeCompleteSkillData(skillElements[i], rarity, category, skillName));
            }
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
    logger(`~일반 예상 횟수 : ${partCount.일반once + partCount.일반multi}, once : ${partCount.일반once}, multiple : ${partCount.일반multi}`);
    logger(`~일반 실제 횟수 : ${currentSimulateCount}, once : ${currentOnceCount}, multiple : ${currentMultipleCount}`);

    //--------------------------------------------------고유기 마신 계산-------------------------------------------------------
    result_Final['고유기'] = [];

    //고유기를 선택하지 않았을때만 계산
    if (!isUniqueSkillSelected) {
        result_Final['고유기'] = [
            ...await makeCompleteSkillDatas(notHeal_unique_Skill_Elements, '고유')
        ];

        //result_Inherit에는 3성 계승기만 존재하며, 그 중 '특수'는 빠져있다.
        //고유와 계승의 분류가 다른 스킬 때문에, 계승기를 기반으로 분류 -> 스킬DB에서 검색하는 방식으로 변경.


        //2성은 계승기가 없으므로 SkillDB에서 검색
        /*for (let i=0; i<uniqueSkills['속가복']['2성']['요소 배열'].length; i++) {
                let element = uniqueSkills['속가복']['2성']['요소 배열'][i];
                let skillName = getProperSkillName(element);
                let skillData = skillDB.find(v=>v['스킬명(한섭 시뮬)'] === skillName);
                let category = (typeof(skillData) === 'undefined'? '': skillData['분류']);

                result_Final['고유기'].push(await makeCompleteSkillData(element, '고유', category, skillName));
            }*/

        //원래 SkillDB보다 시뮬에서 받아온 정보가 더 최신이므로 계승기에서 검색하였으나,
        //스킵 방식을 이름 배열 -> 스킬DB 특수 방식으로 변경했기 때문에, 스킬DB에서 읽어오는것으로 통합.
        //3성은 계승기가 있으므로 앞서한 계승기에서 검색
        /*for (let i=0; i<uniqueSkills['속가복']['3성']['요소 배열'].length; i++) {
                let element = uniqueSkills['속가복']['3성']['요소 배열'][i];
                let skillName = getProperSkillName(element);
                let skillData = result_Inherit.find(v=>v['스킬명(한섭 시뮬)'] === skillName);
                //클구리, 수르젠 스킵.
                if (skipList.includes(skillName)) {
                   skipped_Skill_Elements.push(element);
                   continue;}
                //특수 스킵
                if (skillData['즉발'] === '특수') {
                    skipped_Skill_Elements.push(skillElements[i]);
                    continue;
                }
                //유저가 활성화한 계승기가 있으면 그 고유기 스킵
                if (userSelected['전체 스킬'].includes(skillName)) {continue;}
                let category = (typeof(skillData) === 'undefined'? '': skillData['분류']);

                result_Final['고유기'].push(await makeCompleteSkillData(element, '고유', category, skillName));
            }*/
        //logger(skipped_Skill_Elements);

        //다 끝났으니 고유기 없음 클릭
        await unique_Skill_Elements[0].click();
    }
    let prediction = makeSkillNamesArray(uniqueSkills['속가복']['3성']['요소 배열'])
    let realResult = makeSkillNamesArray(notHeal_unique_Skill_Elements)
    logger(difference(prediction, realResult));
    logger(`~고유 예상 횟수 : ${partCount.고유once + partCount.고유multi}, once : ${partCount.고유once}, multiple : ${partCount.고유multi}`);
    logger(`~고유 실제 횟수 : ${currentSimulateCount}, once : ${currentOnceCount}, multiple : ${currentMultipleCount}`);


    //--------------------------------------------------따로 계산해야하는 것들 마신 계산-------------------------------------------------------
    result_Final['특수'] = [];

    //클구리 수르젠의 경우
    //중반 회복기 최속발동시의 타임 <= 스리 세븐 발동시의 타임 : 스리 세븐 무효
    //중반 회복기 최속발동시의 타임 > 스리 세븐 발동시의 타임 : 스리 세븐 유효

    //skipped_Skill_Elements 에 순서는 모르지만 6개 요소 다 들어가있음.
    //el-checkbox-button - 계승기, el-select-dropdown__item - 고유기
    //['크리스마스 이브의 미라클 런!', '뭉클하게♪Chu', '꼬리의 폭포오르기', '꼬리 올리기']
    //['聖夜のミラクルラン！', 'グッときて♪Chu', '尻尾の滝登り', '尻尾上がり']

    //크리스마스 이브의 미라클 런! : 중반 회복기 2 + 777 / U=ma2 / 두근구든 / 하굣길(추입) / 말괄량이(도주)
    //뭉클하게♪Chu : 중반 회복기 1
    //불벼락 : 중반 회복기 2
    //위풍당당, 아름다운 꿈! : 두근두근
    //운을 열어젖혀 날아오르리 : 패시브 0 / 3 / 5 / 6
    //꼬리 솟구쳐 오르기, 꼬리 올리기 : 중반 회복기 3
    //명경지수, 또렷한 생각 : a-star*로 계산하고 그만큼 빼기

    //중반 회복기 2개 / 777 / U=ma2 / 두근구든 / 하굣길(추입) / 말괄량이(도주) / 패시브 6개 / a-star*
    let triggerParents = {
        '일반힐': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[2]/div[2]/div/div[2]/div"),
        '계승힐': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[2]/div[2]/div/div[3]/div"),
        '계승복합힐': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[5]/div[2]/div/div[3]/div"),
        '상위패시브': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[1]/div"),
        '하위패시브': getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[2]/div")
    };
    let triggerElements = {
        '중반힐1': triggerParents['일반힐'].querySelector("input[value='20']").parentElement, //페이스 킵
        '중반힐2': triggerParents['일반힐'].querySelector("input[value='21']").parentElement, //마군 속 냉정
        '중반힐3': triggerParents['일반힐'].querySelector("input[value='23']").parentElement, //아오하루 점화 체
        '코너회복': triggerParents['일반힐'].querySelector("input[value='0']").parentElement,
        '777': triggerParents['일반힐'].querySelector("input[value='3']").parentElement,
        'uma2': triggerParents['계승복합힐'].querySelector("input[value='9']").parentElement,
        '두근두근': triggerParents['계승힐'].querySelector("input[value='2']").parentElement,
        '날씨': triggerParents['하위패시브'].querySelector("input[value='24']").parentElement,
        '집중마크': triggerParents['하위패시브'].querySelector("input[value='25']").parentElement
    };
    if (userSelected['각질'] === '추입') { triggerElements['하굣길'] = triggerParents['일반힐'].querySelector("input[value='5']").parentElement; }
    if (userSelected['각질'] === '도주') { triggerElements['기세로'] = triggerParents['일반힐'].querySelector("input[value='6']").parentElement; }
    if (userSelected['마장'] === '더트') { triggerElements['astar'] = triggerParents['계승복합힐'].querySelector("input[value='11']").parentElement; }

    triggerParents['상위패시브'].querySelectorAll("label").forEach((e) => {
        if (e.innerText.includes('근간거리◎')) { triggerElements['상위근간'] = e; }
        if (e.innerText.includes('경기장◎')) { triggerElements['상위경기장'] = e; }
    });
    triggerParents['하위패시브'].querySelectorAll("label").forEach((e) => {
        if (e.innerText.includes('근간거리○')) { triggerElements['하위근간'] = e; }
        if (e.innerText.includes('경기장○')) { triggerElements['하위경기장'] = e; }
    });

    //스킬 발동 구간 드롭다운 메뉴를 클릭해서 최하위로 보낸뒤 주소 가져옴.
    await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(5) > div > div").click();
    let randomPosition_Parent = document.querySelector("body > div.el-select-dropdown.el-popper:last-child > div > div > ul");


    //특수 애들 처리용.
    async function getSpecialSkillData(triggerSkillElements, skillElement, addText = '', is777 = false, rarity = '') {
        const turnedOnArray = await toggleSkills(triggerSkillElements, true);
        const originalStatusArray = turnedOnArray.map(bool => !bool)

        if (rarity === '') rarity = isUniqueSkill(skillElement) ? '고유' : '계승';
        let skillName = getProperSkillName(skillElement)
        if (addText !== '') { skillName += `(${addText})`; } //추가 텍스트 있으면 추가해서 검색
        let skillData = await makeCompleteSkillData(skillElement, rarity, undefined, skillName, is777);

        await toggleSkills(triggerSkillElements, originalStatusArray);
        return skillData;
    }

    //logger(skipped_Skill_Elements);
    //skipped_Skill_Elements.forEach((e)=>{logger(getProperSkillName(e));});


    for (let i = 0; i < skipped_Skill_Elements.length; i++) {
        //고유기 선택되었을땐 skipped 에 고유기가 안들어가기 때문에 불필요하긴 한데, 혹시 모르니 그냥 체크.
        //고유기 선택되었고 고유기면 continue
        if (isUniqueSkillSelected && isUniqueSkill(skipped_Skill_Elements[i])) continue;

        switch (getProperSkillName(skipped_Skill_Elements[i])) {
                //크리스마스 이브의 미라클 런! : 중반 회복기 2 + 777 / U=ma2 / 두근구든 / 하굣길(추입) / 말괄량이(도주)
            case '크리스마스 이브의 미라클 런!': {
                await randomPosition_Parent.childNodes[2].click(); //중반 회복기가 최속으로 터지도록, 스킬 발동 구간 가장 빠르게
                const turnedOn1 = await toggleSkill(triggerElements['중반힐1'], true);
                const turnedOn2 = await toggleSkill(triggerElements['중반힐2'], true);

                result_Final['특수'].push(await getSpecialSkillData(triggerElements['777'], skipped_Skill_Elements[i], '777', true));
                result_Final['특수'].push(await getSpecialSkillData(triggerElements['uma2'], skipped_Skill_Elements[i], 'U=ma2', true));
                result_Final['특수'].push(await getSpecialSkillData(triggerElements['두근두근'], skipped_Skill_Elements[i], '두근두근', true));
                if (userSelected['각질'] === '추입') { result_Final['특수'].push(await getSpecialSkillData(triggerElements['하굣길'], skipped_Skill_Elements[i], '하굣길', true)); }
                if (userSelected['각질'] === '도주') { result_Final['특수'].push(await getSpecialSkillData(triggerElements['기세로'], skipped_Skill_Elements[i], '말괄량이', true)); }

                if (turnedOn1) await toggleSkill(triggerElements['중반힐1'], false);
                if (turnedOn2) await toggleSkill(triggerElements['중반힐2'], false);

                await randomPosition_Parent.childNodes[1].click(); //스킬 발동 구간 랜덤으로 복구
                break;
            }
            case '뭉클하게♪Chu': {
                //코너회복, 스리세븐, U=ma2 계산
                let threeSeven_bashin, Uma2_bashin = 0;

                await toggleSkill(skipped_Skill_Elements[i], true); //고유기or계승기 ON

                const turnedOn1 = await toggleSkill(triggerElements['777'], true); //스리 세븐 ON
                threeSeven_bashin = calcBashin(BASETIME, await simulate(true))['평균']
                if (turnedOn1) await toggleSkill(triggerElements['777'], false); //스리 세븐 OFF

                const turnedOn2 = await toggleSkill(triggerElements['uma2'], true); //U=ma2 ON
                Uma2_bashin = calcBashin(BASETIME, await simulate(true))['평균']
                if (turnedOn2) await toggleSkill(triggerElements['uma2'], false); //U=ma2 OFF

                await toggleSkill(skipped_Skill_Elements[i], false); //고유기or계승기 ON

                let skillData = await getSpecialSkillData(triggerElements['코너회복'], skipped_Skill_Elements[i]);
                skillData['특이사항'] = `코너 회복으로 시뮬. 스리세븐 ${threeSeven_bashin}, U=ma2 ${Uma2_bashin}.`;
                result_Final['특수'].push(skillData);
                break;
            }
            case '불벼락': {
                //중반힐 2개
                let triggers = [triggerElements['중반힐1'], triggerElements['중반힐2']]
                result_Final['특수'].push(await getSpecialSkillData(triggers, skipped_Skill_Elements[i]));
                break;
            }
            case '위풍당당, 아름다운 꿈!': {
                result_Final['특수'].push(await getSpecialSkillData(triggerElements['두근두근'], skipped_Skill_Elements[i], undefined, true));
                break;
            }
            case '운을 열어젖혀 날아오르리': {
                //운을 열어젖혀 날아오르리 : 패시브 0 / 3 / 5 / 6
                //triggerElements['상위근간'], triggerElements['하위근간'], triggerElements['상위경기장'], triggerElements['하위경기장'], triggerElements['날씨'], triggerElements['집중마크']
                let triggers = [];
                //0~2
                result_Final['특수'].push(await getSpecialSkillData(triggers, skipped_Skill_Elements[i], '0~2'));
                //3~4
                triggers = triggers.concat([triggerElements['상위근간'], triggerElements['하위근간'], triggerElements['상위경기장']]);
                result_Final['특수'].push(await getSpecialSkillData(triggers, skipped_Skill_Elements[i], '3~4'));
                //5
                triggers = triggers.concat([triggerElements['하위경기장'], triggerElements['날씨']]);
                result_Final['특수'].push(await getSpecialSkillData(triggers, skipped_Skill_Elements[i], '5'));
                //6
                triggers.push(triggerElements['집중마크']);
                result_Final['특수'].push(await getSpecialSkillData(triggers, skipped_Skill_Elements[i], '6'));

                break;
            }
            case '꼬리 솟구쳐 오르기': {
                //중반힐 3개
                let triggers = [triggerElements['중반힐1'], triggerElements['중반힐2'], triggerElements['중반힐3']]
                result_Final['특수'].push(await getSpecialSkillData(triggers, skipped_Skill_Elements[i], undefined, false, '레어/상위'));
                break;
            }
            case '꼬리 올리기': {
                //중반힐 3개
                let triggers = [triggerElements['중반힐1'], triggerElements['중반힐2'], triggerElements['중반힐3']]
                result_Final['특수'].push(await getSpecialSkillData(triggers, skipped_Skill_Elements[i], undefined, false, '일반/하위'));
                break;
            }
            case '명경지수': {
                //astar
                let astar_bashin = 0;
                await toggleSkill(triggerElements['astar'], true); //astar ON
                astar_bashin = calcBashin(BASETIME, await simulate(true))['평균'];
                await toggleSkill(triggerElements['astar'], false); //astar OFF

                let skillData = await getSpecialSkillData(triggerElements['astar'], skipped_Skill_Elements[i], undefined, true, '레어/상위');
                skillData['특이사항'] = `합 : ${skillData['마신']} astar: ${astar_bashin}`;
                skillData['마신'] -= astar_bashin;
                result_Final['특수'].push(skillData);
                break;
            }
            case '또렷한 생각': {
                //astar
                let astar_bashin = 0;
                await toggleSkill(triggerElements['astar'], true); //astar ON
                astar_bashin = calcBashin(BASETIME, await simulate(true))['평균'];
                await toggleSkill(triggerElements['astar'], false); //astar OFF

                let skillData = await getSpecialSkillData(triggerElements['astar'], skipped_Skill_Elements[i], undefined, true, '일반/하위');
                skillData['특이사항'] = `합 : ${skillData['마신']} astar: ${astar_bashin}`;
                skillData['마신'] -= astar_bashin;
                result_Final['특수'].push(skillData);
                break;
            }
        }
    }

    //logger(result_Final['특수']);
    logger(`~특수 예상 횟수 : ${partCount.특수once + partCount.특수multi}, once : ${partCount.특수once}, multiple : ${partCount.특수multi}`);
    logger(`~특수 실제 횟수 : ${currentSimulateCount}, once : ${currentOnceCount}, multiple : ${currentMultipleCount}`);

    //--------------------------------------------------마무리-------------------------------------------------------

    //전체 진행도 바 제거
    removeProgressBar(entire_progressbar);

    //logger(result_Final);
    //logger(skillDB);
    logger(`예상 횟수 : ${totalSimulateCount}, once : ${onceCount + multipleCount * 5}, multiple : ${multipleCount * userSimulateCount}`);
    logger(`실제 횟수 : ${currentSimulateCount}, once : ${currentOnceCount}, multiple : ${currentMultipleCount}`);

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
                  ...result_Final['특수']];
    //logger(result);


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

    downloadDictionaryArrayAsTSV(result, filename, firstLine);

};


async function test() {
    let skillDB_csv = await $.get("https://raw.githubusercontent.com/Ravenclaw5874/Auto-Bashin-Table-Generator/main/%EC%8A%A4%ED%82%ACDB.csv");
    let skillDB = $.csv.toObjects(skillDB_csv);
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

