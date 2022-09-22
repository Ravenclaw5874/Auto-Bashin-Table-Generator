// ==UserScript==
// @name         우마무스메 한섭 자동 마신표 제작기
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  한국 우마무스메 레이스 에뮬레이터로 마신표를 자동으로 만드는 스크립트입니다.
// @author       Ravenclaw5874
// @match        http://race-ko.wf-calc.net/
// @icon         https://img1.daumcdn.net/thumb/C151x151/?fname=https%3A%2F%2Ft1.daumcdn.net%2Fcafeattach%2F1ZK1D%2F80ed3bb76fa6ce0a4a0c7a9cc33d55430f797e35
// @grant        none
// @require      http://code.jquery.com/jquery-3.6.1.min.js
// @require      https://raw.githubusercontent.com/evanplaice/jquery-csv/main/src/jquery.csv.js
// @license      MIT License
// ==/UserScript==

if ( ! /#\/champions-meeting.*/.test(location.hash) ) return;

//Xpath로 요소 찾기
function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

//현재 요소가 몇번째 자식인지 알려줌.
function getIndex(element) {
    for(let i = 0; i < element.parentNode.childNodes.length; i++) {
        if (element.parentNode.childNodes[i] === element) {
            //console.log('elemIndex = ' + i);
            return i;
        }
    }
}

async function clickElements(selectors) {
    switch (typeof(selectors[0])) {
            //셀렉터 텍스트 배열일 경우
        case 'string':
            selectors.forEach((selector) => {
                document.querySelector(selector).click();
            });
            break;
            //노드 리스트일 경우
        case 'object':
            for(let i=0; i<selectors.length; i++) {
                await selectors[i].click();
            }
            break;
    }
}

//시뮬레이트 버튼을 클릭하고 끝나면 결과를 반환
function simulate(once/*, isMulti = false*/) {
    return new Promise(async resolve => {
        //복합기 감시자 종료용
        //let isComplete = false;

        //진행도 감시자 설정
        let observer = new MutationObserver(async (mutations) => {

            //시뮬레이션 끝나면
            if(target.ariaValueNow === "100") {
                //감시자 제거
                observer.disconnect();
                //isComplete = true;

                let average = convertToSec(document.querySelector("#app > div.main-frame > div:nth-child(5) > table:nth-child(2) > tr:nth-child(2) > td:nth-child(2)").innerText);
                let fastest,slowest;

                //n번일땐 발동 구간 다섯개도 추가적으로 돌려서 최대 최소 계산
                if (!once) {
                    let randomPosition_Results = [];
                    //n번 돌린 베스트, 워스트 랩타임을 포함
                    randomPosition_Results[0] = convertToSec(document.querySelector("#app > div.main-frame > div:nth-child(5) > table:nth-child(2) > tr:nth-child(2) > td:nth-child(4)").innerText);
                    randomPosition_Results[1] = convertToSec(document.querySelector("#app > div.main-frame > div:nth-child(5) > table:nth-child(2) > tr:nth-child(2) > td:nth-child(5)").innerText);

                    //스킬 발동 구간 드롭다운 메뉴를 클릭해서 최하위로 보낸뒤 주소 가져옴.
                    await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(5) > div > div").click();
                    let randomPosition_Parent = document.querySelector("body > div.el-select-dropdown.el-popper:last-child > div > div > ul");

                    for (let i=2; i<7; i++) {
                        await randomPosition_Parent.childNodes[i].click();
                        randomPosition_Results[i] = (await simulate(true))[0];
                    }

                    fastest = Math.min(...randomPosition_Results);
                    slowest = Math.max(...randomPosition_Results);

                    await randomPosition_Parent.childNodes[1].click();
                }
                else {
                    fastest = average;
                    slowest = average;
                }

                //전체 진행도 갱신
                //if (userSimulateCount<=100) { currentSimulateCount+=1; }
                //else { once? currentSimulateCount+=1: currentSimulateCount+= (userSimulateCount)/100; }
                once? currentSimulateCount+=1: currentSimulateCount+=userSimulateCount;
                updateProgressBar( parseInt(currentSimulateCount/totalSimulateCount*100) );

                //결과값 반환
                let result = [average,fastest,slowest];
                resolve(result);
            }
        });

        let target = document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div.el-dialog__wrapper > div > div.el-dialog__body > div");
        let option = { attributes: true };

        //감시자 생성
        observer.observe(target, option);

        let slowest_Multi;

        //복합기용 랩타임 감시자 설정
        //n회 시뮬시 1회마다의 결과값을 두자리까지만 표시해줘서 포기
        /*if (isMulti) {
            let timeObserver = new MutationObserver((mutations) => {
                if (isComplete) {
                    timeObserver.disconnect();
                }
                else {
                    slowest_Multi = convertToSec()
                }

            });
            let timeTarget = document.querySelector("#app > div.main-frame > div:nth-child(5) > table:nth-child(2) > tr:nth-child(2) > td:nth-child(2)");

            timeObserver.observe(timeTarget, option);
        }*/

        (once ?
         await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(3) > div > button").click()://한번 시뮬
         await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(1) > div > button").click());//n번 시뮬

        document.querySelector("body > div.v-modal").remove();
    });
}

//'1:23.456' 을 83.456으로 전환
function convertToSec(minSec) {
    let sepIndex = minSec.indexOf(':');
    let min = Number(minSec.substr(0,sepIndex));
    let sec = Number(minSec.substr(sepIndex+1));
    return (min*60+sec).toFixed(3)*1;
}

//마신차 계산
function calcBashin(BASETIME, times) {
    //단일 숫자
    if (typeof(times) === 'number') {
        return ((BASETIME - times)*10).toFixed(2)*1;
    }
    //숫자 배열
    else {
        let result = [];
        for (let i=0;i<times.length;i++) {
            result.push( ((BASETIME - times[i])*10).toFixed(2)*1 );
        }
        return result;
    }
}

//텍스트의 양옆 공백 제거 및 ○ -> ◯ 변환(큰원으로)
function getProperSkillName(skillElement) {
    return skillElement.innerText.trimStart().trimEnd().replace('○','◯');
}

//전체 진행도 바 생성
function createProgressBar() {
    let original = document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div.el-dialog__wrapper > div > div.el-dialog__body > div");
    let newProgressbar = original.cloneNode(true);
    original.after(newProgressbar);
    newProgressbar.before("전체 진행도");

    return newProgressbar;
}

//전체 진행도 바 제거
function removeProgressBar(progressbar) {
    progressbar.previousSibling.remove();
    progressbar.remove();
}

//전체 진행도 바 업데이트
function updateProgressBar(percent) {
    entire_progressbar.ariaValueNow = percent;
    entire_progressbar.querySelector("div.el-progress-bar > div > div").setAttribute("style", `width: ${percent}%`);
    entire_progressbar.querySelector("div.el-progress__text").innerText = `${percent}%`;
}


let userSimulateCount=0; //유저가 설정한 시뮬 횟수
let totalSimulateCount=0; //계산된 총 시뮬 횟수
let currentSimulateCount=0; //현재 누적 시뮬 횟수
let entire_progressbar; //전체 진행 바 요소

var main = function() {
    'use strict';
    // Your code here...
    (async () => {
        userSimulateCount=0; //유저가 설정한 시뮬 횟수
        totalSimulateCount=0; //계산된 총 시뮬 횟수
        currentSimulateCount=0; //현재 누적 시뮬 횟수

        //스킬 DB 불러오기
        let skillDB_csv = await $.get("https://raw.githubusercontent.com/Ravenclaw5874/Auto-Bashin-Table-Generator/main/%EC%8A%A4%ED%82%ACDB.csv");
        let skillDB = $.csv.toObjects(skillDB_csv);
        //console.table(skillDB);

        //시뮬 횟수 얼만지 가져오기
        userSimulateCount = Number(document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(2) > div > div > div > input").ariaValueNow);

        //전체 난수 고정 선택
        //await clickElements("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(4) > div > div > div");
        await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(4) > div > div > div").click();
        let skill_invoke_rate_bonus = document.querySelectorAll("body > div.el-select-dropdown.el-popper");
        await skill_invoke_rate_bonus[skill_invoke_rate_bonus.length-1].querySelector("div > div > ul > li:nth-child(3)").click();
        //document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(4) > div > div > div").click();


        //현재 설정된 정보를 읽어서 저장
        let simulateOptionSelectors = ["#app > div.main-frame > form > div:nth-child(14) > div > div > div",//각질
                                       "#app > div.main-frame > form > div:nth-child(15) > div > div > div",//거리 적성
                                       "#app > div.main-frame > form > div:nth-child(16) > div > div > div",//경기장 적성
                                       "#app > div.main-frame > form > div:nth-child(17) > div > div > div",//각질 적성
                                       "#app > div.main-frame > form > div:nth-child(18) > div > div > div",//컨디션
                                       "#app > div.main-frame > form > div:nth-child(20) > div > div:nth-child(1) > div",//코스 장소
                                       "#app > div.main-frame > form > div:nth-child(20) > div > div:nth-child(2) > div",//코스 종류 및 거리
                                       "#app > div.main-frame > form > div:nth-child(21) > div > div > div",//코스 상태
                                       "#app > div.main-frame > form > div:nth-child(23) > div > div > div"//고유 스킬
                                      ];

        await clickElements(simulateOptionSelectors);

        let dropDownNodes = document.querySelectorAll("body > div.el-select-dropdown.el-popper");

        let strategy_Parent           = dropDownNodes[dropDownNodes.length-9].querySelector("div > div > ul"); //각질
        let distanceAptitude_Parent   = dropDownNodes[dropDownNodes.length-8].querySelector("div > div > ul"); //거리 적성
        let surfaceAptitude_Parent    = dropDownNodes[dropDownNodes.length-7].querySelector("div > div > ul"); //경기장 적성
        let strategyAptitude_Parent   = dropDownNodes[dropDownNodes.length-6].querySelector("div > div > ul"); //각질 적성
        let mood_Parent               = dropDownNodes[dropDownNodes.length-5].querySelector("div > div > ul"); //컨디션
        let courseLocation_Parent     = dropDownNodes[dropDownNodes.length-4].querySelector("div > div > ul"); //코스 장소
        let courseTypeDistance_Parent = dropDownNodes[dropDownNodes.length-3].querySelector("div > div > ul"); //코스 종류 및 거리
        let courseCondition_Parent    = dropDownNodes[dropDownNodes.length-2].querySelector("div > div > ul"); //코스 상태
        let uniqueSkill_Parent        = dropDownNodes[dropDownNodes.length-1].querySelector("div > div > ul"); //고유 스킬

        let userSelected_Strategy           = strategy_Parent.querySelector("ul > li.selected");
        let userSelected_DistanceAptitude   = distanceAptitude_Parent.querySelector("ul > li.selected");
        let userSelected_SurfaceAptitude    = surfaceAptitude_Parent.querySelector("ul > li.selected");
        let userSelected_StrategyAptitude   = strategyAptitude_Parent.querySelector("ul > li.selected");
        let userSelected_Mood               = mood_Parent.querySelector("ul > li.selected");
        let userSelected_CourseLocation     = courseLocation_Parent.querySelector("ul > li.selected");
        let userSelected_CourseTypeDistance = courseTypeDistance_Parent.querySelector("ul > li.selected");
        let userSelected_CourseCondition    = courseCondition_Parent.querySelector("ul > li.selected");

        //console.log("작전: " + userSelected_Strategy.innerText);
        //console.log("적성: " + userSelected_DistanceAptitude.innerText + " " + userSelected_SurfaceAptitude.innerText + " " + userSelected_StrategyAptitude.innerText);
        //console.log("컨디션: " + userSelected_Mood.innerText);
        //console.log("코스: " + userSelected_CourseLocation.innerText + " " + userSelected_CourseTypeDistance.innerText + " " + userSelected_CourseCondition.innerText);

        await clickElements(simulateOptionSelectors);

        //계승, 일반기들
        let speed_Rare_Elements    = getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[3]/div[2]/div/div[1]/div").childNodes;
        let speed_Normal_Elements  = getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[3]/div[2]/div/div[2]/div").childNodes;
        let speed_Inherit_Elements = getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[3]/div[2]/div/div[3]/div").childNodes;

        let accel_Rare_Elements    = getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[4]/div[2]/div/div[1]/div").childNodes;
        let accel_Normal_Elements  = getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[4]/div[2]/div/div[2]/div").childNodes;
        let accel_Inherit_Elements = getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[4]/div[2]/div/div[3]/div").childNodes;

        let multi_Rare_Elements    = getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[5]/div[2]/div/div[1]/div").childNodes;
        let multi_Normal_Elements  = getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[5]/div[2]/div/div[2]/div").childNodes;
        let multi_Inherit_Elements = getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[5]/div[2]/div/div[3]/div").childNodes;

        //고유기들
        let heal_3Star_Elements = getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[2]/div[2]/div/div[3]/div").childNodes;

        function makeSkillNamesArray(skillElements) {
            let result = [];
            skillElements.forEach((node) => {result.push(getProperSkillName(node) );});
            return result;
        }
        let heal_3Star_SkillNames = makeSkillNamesArray(heal_3Star_Elements);
        let heal_2Star_SkillNames = ['클리어 하트', '두근두근 준비 땅!'];

        //타키온 고유기가 회복기면 제거할 대상에 2성 고유기 추가.
        if (heal_3Star_SkillNames.includes('U=ma2')) {
            heal_2Star_SkillNames.push('introduction：My body');
        }

        let unique_Skill_Elements = uniqueSkill_Parent.childNodes;
        unique_Skill_Elements = Array.prototype.slice.call(unique_Skill_Elements);
        unique_Skill_Elements.shift();

        let needToDelete_SkillNames = ['없음／발동 안 함',
                                       ...heal_3Star_SkillNames,
                                       ...heal_2Star_SkillNames]
        //3성 속/가/복 고유기 이름들
        let notHeal_3Star_Unique_SkillNames = [...makeSkillNamesArray(speed_Inherit_Elements),
                                               ...makeSkillNamesArray(accel_Inherit_Elements),
                                               ...makeSkillNamesArray(multi_Inherit_Elements)]

        //전체 속/가/복 고유기 요소들.
        let notHeal_unique_Skill_Elements = unique_Skill_Elements.filter(x => !needToDelete_SkillNames.includes(getProperSkillName(x)));
        //2성 속/가/복 고유기 요소들
        let notHeal_2Star_unique_Skill_Elements = notHeal_unique_Skill_Elements.filter(x => !notHeal_3Star_Unique_SkillNames.includes(getProperSkillName(x)));
        //3성 속/가/복 고유기 요소들.
        let notHeal_3Star_unique_Skill_Elements = notHeal_unique_Skill_Elements.filter(x => notHeal_3Star_Unique_SkillNames.includes(getProperSkillName(x)));



        await uniqueSkill_Parent.childNodes[1].click();//고유 스킬 초기화
        //await clickElements("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(3) > div > button");
        await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(3) > div > button").click();//활성화를 위한 한번 시뮬

        //전체 진행도 바 생성
        entire_progressbar = createProgressBar();
        updateProgressBar(0);

        //기준 타임 계산
        let basetimes = await simulate(true);
        let BASETIME = basetimes[0];
        //console.log('기준 타임: ' + BASETIME);



        //유저가 선택한 적성 인덱스
        let index_dist = getIndex(userSelected_DistanceAptitude);
        let index_surf = getIndex(userSelected_SurfaceAptitude);

        //전체 시뮬 횟수 계산
        let onceCount = 0;
        let multipleCount = 0;
        onceCount += (index_dist===1? 2: index_dist) * (index_surf===1? 2: index_surf); //적성
        onceCount += 4; //녹딱
        onceCount += 9; //기준타임 1번 + 클구리,수르젠 고유/계승 검증용 2번씩 8번

        let allSkills = makeSkillNamesArray([...notHeal_unique_Skill_Elements,//고유기
                                             ...speed_Rare_Elements,
                                             ...speed_Normal_Elements,
                                             ...accel_Rare_Elements,
                                             ...accel_Normal_Elements,
                                             ...multi_Rare_Elements,
                                             ...multi_Normal_Elements,
                                             ...speed_Inherit_Elements,
                                             ...accel_Inherit_Elements,
                                             ...multi_Inherit_Elements])//일반, 계승기
        //console.log(allSkills);
        allSkills.forEach((skillName)=>{
            let skillData = skillDB.find(v=>v['스킬명'] === skillName);
            if (typeof(skillData) === 'undefined') {multipleCount+=1;}
            else (skillData['즉발'] === '즉발'? onceCount+=1: multipleCount+=1);
        });
        //console.log(`즉발 ${onceCount}개 랜덤 ${multipleCount}개 ${userSimulateCount}회 시뮬`);

        totalSimulateCount = onceCount + multipleCount * (userSimulateCount + 5);
        //console.log(totalSimulateCount);


        //적성 마신 계산
        let result_Aptitude = [];

        //거리S 경기장S로 돌려도 비교를 위해 최소 AA까지는 시뮬.
        for (let i = 1; i <= (index_dist===1? 2: index_dist); i++) {
            for (let j = 1; j <= (index_surf===1? 2: index_surf); j++) {
                //console.log(distanceAptitude_Parent.childNodes[i].innerText + " " + surfaceAptitude_Parent.childNodes[j].innerText);
                await distanceAptitude_Parent.childNodes[i].click();
                await surfaceAptitude_Parent.childNodes[j].click();

                let row = {};
                row['희귀'] = '적성';
                row['분류'] = '적성';
                row['마신'] = calcBashin(BASETIME, await simulate(true))[0];
                row['스킬명'] = '거리' + distanceAptitude_Parent.childNodes[i].innerText + ' 경기장' + surfaceAptitude_Parent.childNodes[j].innerText;
                row['보유 말딸'] = '';
                row['최대'] = '';
                row['최소'] = '';
                row['특이사항'] = '';
                row['발동 구간'] = '';
                row['즉발'] = '즉발';
                row['속도'] = '';
                row['가속'] = '';
                row['지속'] = '';
                row['스킬 Pt'] = '';
                row['각질'] = '';
                row['거리'] = '';
                row['예상 출시일'] = '2022년 6월 20일';

                result_Aptitude.push(row);
            }
        }

        //제일 마지막 적성의 마신이 음수면 S이상으로 돌려서 A까지 간것이므로 모든 요소에 그만큼 더하기.
        let lastBashin = result_Aptitude[result_Aptitude.length-1]['마신'];
        if (lastBashin < 0) {
            result_Aptitude.forEach((row)=>{row['마신'] += (-lastBashin)});
        }

        //원상복구
        userSelected_DistanceAptitude.click();
        userSelected_SurfaceAptitude.click();
        //console.table(result_Aptitude);


        //녹딱 마신 계산
        let result_Passive = [];

        let speed_rare = getElementByXpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[1]/div/label[2]/span');
        let power_rare = getElementByXpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[1]/div/label[9]/span');
        let speed_normal = getElementByXpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[2]/div/label[2]/span');
        let power_normal = getElementByXpath('/html/body/div[1]/div[1]/form/div[21]/div[1]/div[2]/div/div[2]/div/label[11]/span');


        result_Passive[0] = await makeCompleteSkillData(speed_rare, '레어/상위', '녹딱', '스피드◎');
        result_Passive[1] = await makeCompleteSkillData(power_rare, '레어/상위', '녹딱', '파워◎');
        result_Passive[2] = await makeCompleteSkillData(speed_normal, '일반/하위', '녹딱', '스피드◯');
        result_Passive[3] = await makeCompleteSkillData(power_normal, '일반/하위', '녹딱', '파워◯');

        //console.table(result_Passive);
        //console.table([...result_Passive, ...result_Aptitude]);


        //일반기 마신 계산
        let result_Normal = [];


        //스킬 버튼 요소를 넣으면 마신차들 반환
        async function simulateSingleSkill(skillElement, once) {
            await skillElement.click();
            let bashins = calcBashin(BASETIME, await simulate(once));
            await skillElement.click();

            return bashins
        }

        //스킬 버튼 요소를 넣으면 마신차를 포함한 완전한 스킬 데이터를 반환.
        async function makeCompleteSkillData(skillElement, rarity, category, skillName, is777 = false) {
            let skillData = skillDB.find(v=>v['스킬명'] === skillName && v['희귀'] === rarity);

            //스킬DB에 없는 스킬이면 데이터 새로 만듦
            if (typeof(skillData) === 'undefined') {
                skillData = {};
                skillData['스킬명'] = getProperSkillName(skillElement);
            }

            //희귀도, 분류 지정
            skillData['희귀'] = rarity;
            skillData['분류'] = category;


            //스킬 데이터에 즉발이라 되어있으면 한번, 랜덤 혹은 불명이면 n번
            // 777 수르젠일 경우는 즉발이므로 한번.
            let once = (is777 || skillData['즉발'] === '즉발'? true: false);


            let bashins = await simulateSingleSkill(skillElement, once);

            skillData['마신'] = bashins[0];
            if (!once) {
                skillData['최대'] = bashins[1];
                skillData['최소'] = bashins[2];
            }

            return skillData;
        }

        //스킵한 스킬 요소 저장용.
        let skipped_Skill_Elements = [];
        //클구리, 수르젠, 꼬올은 나중에 따로 계산
        let skipList = ['성야의 미라클 런!', '뭉클하게♪ Chu', '꼬리의 폭포오르기', '꼬리 올리기']

        //배열용.
        async function makeCompleteSkillDatas(skillElements, rarity, category) {
            let result = [];
            for (let i=0; i<skillElements.length; i++) {

                if (skipList.includes(getProperSkillName(skillElements[i]))) {
                    skipped_Skill_Elements.push(skillElements[i]);
                    continue;
                }
                else {
                    result.push(await makeCompleteSkillData(skillElements[i], rarity, category, getProperSkillName(skillElements[i])));
                }
            }
            return result;
        }




        //고유기때 써먹으려고 분리
        let result_Inherit = [
            ...await makeCompleteSkillDatas(speed_Inherit_Elements, '계승',      '속도'),
            ...await makeCompleteSkillDatas(accel_Inherit_Elements, '계승',      '가속'),
            ...await makeCompleteSkillDatas(multi_Inherit_Elements, '계승',      '복합')
        ]

        result_Normal = [
            ...await makeCompleteSkillDatas(speed_Rare_Elements,    '레어/상위', '속도'),
            ...await makeCompleteSkillDatas(speed_Normal_Elements,  '일반/하위', '속도'),
            ...await makeCompleteSkillDatas(accel_Rare_Elements,    '레어/상위', '가속'),
            ...await makeCompleteSkillDatas(accel_Normal_Elements,  '일반/하위', '가속'),
            ...await makeCompleteSkillDatas(multi_Rare_Elements,    '레어/상위', '복합'),
            ...await makeCompleteSkillDatas(multi_Normal_Elements,  '일반/하위', '복합'),
            ...result_Inherit
        ]
        //console.table(result_Normal);





        //고유기 마신 계산
        let result_Unique = [];

        //2성은 계승기가 없으므로 SkillDB에서 검색

        for (let i=0; i<notHeal_2Star_unique_Skill_Elements.length; i++) {
            let element = notHeal_2Star_unique_Skill_Elements[i];
            let skillName = getProperSkillName(element);
            let skillData = skillDB.find(v=>v['스킬명'] === skillName);
            let category = (typeof(skillData) === 'undefined'? '': skillData['분류']);

            result_Unique.push(await makeCompleteSkillData(element, '고유', category, skillName));
        }

        //3성은 계승기가 있으므로 앞서한 계승기에서 검색
        for (let i=0; i<notHeal_3Star_unique_Skill_Elements.length; i++) {
            let element = notHeal_3Star_unique_Skill_Elements[i];
            let skillName = getProperSkillName(element);
            //클구리, 수르젠 스킵.
            if (skipList.includes(skillName)) {
                skipped_Skill_Elements.push(element);
                continue;}
            let skillData = result_Inherit.find(v=>v['스킬명'] === skillName);
            let category = (typeof(skillData) === 'undefined'? '': skillData['분류']);

            result_Unique.push(await makeCompleteSkillData(element, '고유', category, skillName));
        }
        //console.log(skipped_Skill_Elements);

        //다 끝났으니 고유기 없음 클릭
        await unique_Skill_Elements[0].click();

        /*for (let i=0; i<notHeal_unique_Skill_Elements.length; i++) {
            let element = notHeal_unique_Skill_Elements[i];
            let skillName = getProperSkillName(element);
            let skillData = skillDB.find(v=>v['스킬명'] === skillName);
            let category = (typeof(skillData) === 'undefined'? '': skillData['분류']);

            result_Unique.push(await makeCompleteSkillData(element, '고유', category, skillName));
        }*/

        //클구리, 수르젠, 꼬리올리기는 따로 계산
        let result_Special = [];

        //클구리 수르젠의 경우
        //중반 회복기 최속발동시의 타임 <= 스리 세븐 발동시의 타임 : 스리 세븐 무효
        //중반 회복기 최속발동시의 타임 > 스리 세븐 발동시의 타임 : 스리 세븐 유효

        //skipped_Skill_Elements 에 순서는 모르지만 6개 요소 다 들어가있음.
        //el-checkbox-button - 계승기, el-select-dropdown__item - 고유기
        //['성야의 미라클 런!', '뭉클하게♪ Chu', '꼬리의 폭포오르기', '꼬리 올리기']

        //중반 회복기 페이스 킵, 마군 속 냉정, 아오하루 점화*체력
        let heal_Normal_Parent = getElementByXpath("/html/body/div[1]/div[1]/form/div[21]/div[2]/div[2]/div/div[2]/div");
        let mid_HealSkill_Elements = [heal_Normal_Parent.querySelector("input[value='20']"),
                                      heal_Normal_Parent.querySelector("input[value='21']"),
                                      heal_Normal_Parent.querySelector("input[value='23']")]
        //스리세븐
        let three_Seven_Element = heal_Normal_Parent.querySelector("input[value='3']");

        //스킬 발동 구간 드롭다운 메뉴를 클릭해서 최하위로 보낸뒤 주소 가져옴.
        await document.querySelector("#app > div.main-frame > form > div:nth-child(28) > div:nth-child(5) > div > div").click();
        let randomPosition_Parent = document.querySelector("body > div.el-select-dropdown.el-popper:last-child > div > div > ul");

        let threeSeven_time, non_ThreeSeven_time = 0;

        for(let i=0; i<skipped_Skill_Elements.length; i++) {
            //고유기
            if (skipped_Skill_Elements[i].className.includes('el-select-dropdown__item')) {
                switch(getProperSkillName(skipped_Skill_Elements[i])) {
                    case '성야의 미라클 런!':
                        await clickElements(mid_HealSkill_Elements); //중반 회복기 3개 ON
                        await randomPosition_Parent.childNodes[2].click(); //가장 빠르게
                        await skipped_Skill_Elements[i].click(); //고유기 ON
                        non_ThreeSeven_time = await simulate(true);
                        //현재 고유기, 중반 회복기 0,1,2 ON

                        await mid_HealSkill_Elements[2].click(); //중반 회복기 2 OFF
                        await three_Seven_Element.click(); //스리 세븐 ON
                        threeSeven_time = await simulate(true);
                        //현재 고유기, 중반 회복기 0,1, 스리 세븐 ON

                        await randomPosition_Parent.childNodes[1].click(); //랜덤

                        //스리 세븐 유효. 접속인지는 알 수 없음.
                        if (non_ThreeSeven_time > threeSeven_time) {
                            let skillData = await makeCompleteSkillData(skipped_Skill_Elements[i], '고유', '복합', '성야의 미라클 런!');
                            skillData['특이사항'] = `중반 회복기 2개, 스리 세븐으로 시뮬. 스리 세븐 트리거시 ${calcBashin(BASETIME, threeSeven_time)[0]}.`;
                            result_Special.push(skillData);

                            await three_Seven_Element.click(); //스리 세븐 OFF
                            await mid_HealSkill_Elements[0].click();
                            await mid_HealSkill_Elements[1].click(); //중반 회복기 0,1 OFF
                        }
                        //스리 세븐 무효.
                        else {
                            await three_Seven_Element.click(); //스리 세븐 OFF
                            await mid_HealSkill_Elements[2].click(); //중반 회복기 2 ON
                            let skillData = await makeCompleteSkillData(skipped_Skill_Elements[i], '고유', '복합', '성야의 미라클 런!');
                            skillData['특이사항'] = '중반 회복기 3개로 시뮬. 스리 세븐 무효.';
                            result_Special.push(skillData);

                            await clickElements(mid_HealSkill_Elements); //중반 회복기 3개 OFF
                        }
                        await unique_Skill_Elements[0].click(); //고유기 OFF
                        break;

                    case '뭉클하게♪ Chu':
                        await mid_HealSkill_Elements[0].click(); //중반 회복기 1개 ON
                        await randomPosition_Parent.childNodes[2].click(); //가장 빠르게
                        await skipped_Skill_Elements[i].click(); //고유기 ON
                        non_ThreeSeven_time = await simulate(true);
                        //현재 고유기, 중반 회복기 0 ON

                        await mid_HealSkill_Elements[0].click(); //중반 회복기 1개 OFF
                        await three_Seven_Element.click(); //스리 세븐 ON
                        threeSeven_time = await simulate(true);
                        //현재 고유기, 스리 세븐 ON

                        await randomPosition_Parent.childNodes[1].click(); //랜덤

                        //스리 세븐 유효. 접속인지는 알 수 없음.
                        if (non_ThreeSeven_time > threeSeven_time) {
                            let skillData = await makeCompleteSkillData(skipped_Skill_Elements[i], '고유', '속도', '뭉클하게♪ Chu', true);
                            skillData['특이사항'] = '스리 세븐으로 시뮬.'
                            result_Special.push(skillData);

                            await three_Seven_Element.click(); //스리 세븐 OFF
                        }
                        //스리 세븐 무효.
                        else {
                            await three_Seven_Element.click(); //스리 세븐 OFF
                            await mid_HealSkill_Elements[0].click(); //중반 회복기 1개 ON
                            let skillData = await makeCompleteSkillData(skipped_Skill_Elements[i], '고유', '속도', '뭉클하게♪ Chu');
                            skillData['특이사항'] = `중반 회복기로 시뮬. 최속 발동시 ${calcBashin(BASETIME, non_ThreeSeven_time)[0]}.`
                            result_Special.push(skillData);

                            await mid_HealSkill_Elements[0].click(); //중반 회복기 1개 OFF
                        }
                        await unique_Skill_Elements[0].click(); //고유기 OFF
                        break;
                }
            }
            //계승, 일반기
            //makeCompleteSkillData 함수에서 스킬 ON -> 시뮬 -> 스킬 OFF 하게 짰으므로 고유기와는 다르게 스킬을 끈 상태로 함수 호출해야함.
            else {
                switch(getProperSkillName(skipped_Skill_Elements[i])) {
                    case '성야의 미라클 런!':
                        await randomPosition_Parent.childNodes[2].click(); //가장 빠르게

                        await clickElements(mid_HealSkill_Elements); //중반 회복기 3개 ON
                        await skipped_Skill_Elements[i].click(); //계승기 ON
                        non_ThreeSeven_time = await simulate(true);
                        //현재 계승기, 중반 회복기 0,1,2 ON

                        await mid_HealSkill_Elements[2].click(); //중반 회복기 2 OFF
                        await three_Seven_Element.click(); //스리 세븐 ON
                        threeSeven_time = await simulate(true);
                        //현재 계승기, 중반 회복기 0,1, 스리 세븐 ON

                        await randomPosition_Parent.childNodes[1].click(); //랜덤
                        await skipped_Skill_Elements[i].click(); //계승기 OFF

                        //스리 세븐 유효. 접속인지는 알 수 없음.
                        if (non_ThreeSeven_time > threeSeven_time) {
                            let skillData = await makeCompleteSkillData(skipped_Skill_Elements[i], '계승', '복합', '성야의 미라클 런!');
                            skillData['특이사항'] = `중반 회복기 2개, 스리 세븐으로 시뮬. 스리 세븐 트리거시 ${calcBashin(BASETIME, threeSeven_time)[0]}.`;
                            result_Special.push(skillData);

                            await three_Seven_Element.click(); //스리 세븐 OFF
                            await mid_HealSkill_Elements[0].click();
                            await mid_HealSkill_Elements[1].click(); //중반 회복기 0,1 OFF
                        }
                        //스리 세븐 무효.
                        else {
                            await three_Seven_Element.click(); //스리 세븐 OFF
                            await mid_HealSkill_Elements[2].click(); //중반 회복기 2 ON
                            let skillData = await makeCompleteSkillData(skipped_Skill_Elements[i], '계승', '복합', '성야의 미라클 런!');
                            skillData['특이사항'] = '중반 회복기 3개로 시뮬. 스리 세븐 무효.';
                            result_Special.push(skillData);

                            await clickElements(mid_HealSkill_Elements); //중반 회복기 3개 OFF
                        }
                        break;
                    case '뭉클하게♪ Chu':
                        await mid_HealSkill_Elements[0].click(); //중반 회복기 1개 ON
                        await randomPosition_Parent.childNodes[2].click(); //가장 빠르게
                        await skipped_Skill_Elements[i].click(); //계승기 ON
                        non_ThreeSeven_time = await simulate(true);
                        //현재 계승기, 중반 회복기 0 ON

                        await mid_HealSkill_Elements[0].click(); //중반 회복기 1개 OFF
                        await three_Seven_Element.click(); //스리 세븐 ON
                        threeSeven_time = await simulate(true);
                        //현재 계승기, 스리 세븐 ON

                        await randomPosition_Parent.childNodes[1].click(); //랜덤
                        await skipped_Skill_Elements[i].click(); //계승기 OFF

                        //스리 세븐 유효. 접속인지는 알 수 없음.
                        if (non_ThreeSeven_time > threeSeven_time) {
                            let skillData = await makeCompleteSkillData(skipped_Skill_Elements[i], '계승', '속도', '뭉클하게♪ Chu', true);
                            skillData['특이사항'] = '스리 세븐으로 시뮬.'
                            result_Special.push(skillData);

                            await three_Seven_Element.click(); //스리 세븐 OFF
                        }
                        //스리 세븐 무효.
                        else {
                            await three_Seven_Element.click(); //스리 세븐 OFF
                            await mid_HealSkill_Elements[0].click(); //중반 회복기 1개 ON
                            let skillData = await makeCompleteSkillData(skipped_Skill_Elements[i], '계승', '속도', '뭉클하게♪ Chu');
                            skillData['특이사항'] = `중반 회복기로 시뮬. 최속 발동시 ${calcBashin(BASETIME, non_ThreeSeven_time)[0]}.`;
                            result_Special.push(skillData);

                            await mid_HealSkill_Elements[0].click(); //중반 회복기 1개 OFF
                        }
                        break;

                        //얘네 둘은 위 방식으로 스리세븐이 유효인지 아닌지 알 수 없으므로 그냥 중반 회복기 3개로 계산.
                        //어차피 위에 두개랑은 다르게 회복기만 조건이 아니라 '중반기'가 조건이므로 스리세븐으로 트리거하기 어려움.
                    case '꼬리의 폭포오르기':
                        await clickElements(mid_HealSkill_Elements); //중반 회복기 3개 ON
                        result_Special.push(await makeCompleteSkillData(skipped_Skill_Elements[i], '레어/상위', '속도', '꼬리의 폭포오르기'));
                        await clickElements(mid_HealSkill_Elements); //중반 회복기 3개 OFF
                        break;
                    case '꼬리 올리기':
                        await clickElements(mid_HealSkill_Elements); //중반 회복기 3개 ON
                        result_Special.push(await makeCompleteSkillData(skipped_Skill_Elements[i], '일반/하위', '속도', '꼬리 올리기'));
                        await clickElements(mid_HealSkill_Elements); //중반 회복기 3개 OFF
                        break;

                }
            }
        }

        //전체 진행도 바 제거
        removeProgressBar(entire_progressbar);


        let result_Final = [...result_Aptitude,
                            ...result_Passive,
                            ...result_Unique,
                            ...result_Normal,
                            ...result_Special]

        //console.table(result_Final);
        //console.log(currentSimulateCount);

        function downloadUnicodeCSV(filename, datasource) {
            let link = document.createElement('a');
            link.setAttribute('href', 'data:text/csv;charset=utf-8,%EF%BB%BF' + encodeURIComponent($.csv.fromObjects(datasource)));
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        let filename = `${userSelected_Strategy.innerText} - ${userSelected_CourseLocation.innerText} ${userSelected_CourseTypeDistance.innerText} ${userSelected_CourseCondition.innerText}`
        downloadUnicodeCSV(filename, result_Final);


    })();
}


async function test() {

    createProgressBar();
}




let button = document.createElement("button");
button.setAttribute("class", "el-button el-button--success");
button.innerText = "마신표 제작 시작"
button.onclick = () => {
    main();
}
document.querySelector("#app > div.main-frame > form").appendChild(button);

let button2 = document.createElement("button");
button2.setAttribute("class", "el-button el-button--default");
button2.innerText = "테스트"
button2.onclick = () => {
    test();
}
//document.querySelector("#app > div.main-frame > form").appendChild(button2);
