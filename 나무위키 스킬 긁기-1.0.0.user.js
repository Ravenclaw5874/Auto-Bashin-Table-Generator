// ==UserScript==
// @name         나무위키 스킬 긁기
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  try to take over the world!
// @author       Ravenclaw5874
// @match        https://namu.wiki/w/%EC%9A%B0%EB%A7%88%EB%AC%B4%EC%8A%A4%EB%A9%94%20%ED%94%84%EB%A6%AC%ED%8B%B0%20%EB%8D%94%EB%B9%84/%EC%8A%A4%ED%82%AC/%EA%B3%A0%EC%9C%A0%20%EC%8A%A4%ED%82%AC%20%EB%AA%A9%EB%A1%9D
// @match        https://namu.wiki/w/%EC%9A%B0%EB%A7%88%EB%AC%B4%EC%8A%A4%EB%A9%94%20%ED%94%84%EB%A6%AC%ED%8B%B0%20%EB%8D%94%EB%B9%84/%EC%8A%A4%ED%82%AC/%EA%B3%B5%EC%9A%A9%20%EC%8A%A4%ED%82%AC%20%EB%AA%A9%EB%A1%9D
// @match        https://namu.wiki/w/%EC%9A%B0%EB%A7%88%EB%AC%B4%EC%8A%A4%EB%A9%94%20%ED%94%84%EB%A6%AC%ED%8B%B0%20%EB%8D%94%EB%B9%84/%EC%8A%A4%ED%82%AC/%EC%A7%84%ED%99%94%20%EC%8A%A4%ED%82%AC%20%EB%AA%A9%EB%A1%9D
// @icon         https://www.google.com/s2/favicons?sz=64&domain=namu.wiki
// @grant        GM_registerMenuCommand
// ==/UserScript==

const page_category = decodeURIComponent(location.pathname).match(/\/(\S{2}) 스킬 목록/)[1]
let group_basenum = 0;
switch (page_category) {
    default:
    case "고유":
        group_basenum = 0;
        break;
    case "공용":
        group_basenum = 1000;
        break;
}

// element의 직계 자식들 중 childTag 타입인 것들 반환
function childNodes_withTag(element, childTag) {
    return Array.from(element.childNodes).filter(node => node.tagName === childTag)
}

//tr 넣으면 스킬명/데이터/n주년 구분
//function tr_classify(tr) {
//    //데이터
//    if (tr.querySelector(":scope > td").colSpan === 1) {
//        return "데이터";
//    }
//    else if (tr.querySelector(":scope > td").colSpan === 2) {
//        if (tr.querySelector("strong") !== null) {
//            return "스킬명";
//        }
//        else if (tr.querySelector("dl > dt") !== null) {
//            return "n주년";
//        }
//    }
//    return null;
//}

function sum_skillPt(data) {
    data = data.remove(/ \(총 \d{1,3}\)/);
    const skillPt_array = data.split(" / ");

    let sum = 0;
    const skillPt_sum_array = skillPt_array.map(skillPt => {
        sum += parseInt(skillPt);
        return sum;
    });

    return skillPt_sum_array.join(" / ");
}

String.prototype.remove = function(array) {
    let text = this;
    array.forEach(removeText => {
        text = text.replace(removeText, "");
    });
    return text;
}

String.prototype.removeAll = function(array) {
    let text = this;
    array.forEach(removeText => {
        text = text.replaceAll(removeText, "");
    });
    return text;
}

// tbody에서 스킬 데이터 추출
function tbody_juicer(tbody) {
    const skill_data = {}
    const dup_data = {} // (공통) 저장용

    const skill_data_tr_list = tbody.querySelectorAll(':scope > tr:not(:has(> td[colspan="2"]))')
    let label_num = 1;
    const label_num_except_list = ["원본 레어 스킬", "스킬 Pt 소비량"];

    skill_data_tr_list.forEach((tr, index) => {
        // 라벨과 값의 2칸 구성이 아닌 tr은 건너뜀 (발동 조건문 등). 밖에서 필터링하지 않는 이유는 발동 조건문 데이터는 가져와야 해서.
        if (childNodes_withTag(tr, 'TD').length !== 2) {
            return;
        }

        const label_td = tr.querySelector(":scope > td:nth-child(1)");

        const next_tr = skill_data_tr_list[index+1];
        const label_pure = label_td.innerText.trim();
        let label = null;
        let data = null;

        //진화 조건 건너뛰기
        if (label_pure === "진화 조건") {
            return;
        }

        // data 결정
        // 2 라인을 차지하며, 다음 tr이 존재하고, 그 다음 tr의 자식 td가 1개인 경우 : 전제 조건, 발동 조건
        if (label_td.rowSpan === 2 && next_tr !== null && childNodes_withTag(next_tr, 'TD').length === 1) {
            data = next_tr.querySelector(":scope > td").innerText.replaceAll("\n"," ").trim();
        }
        // 1 라인을 차지하며, 자식 td가 2개인 경우 : 속도 상승량 등
        else if (label_td.rowSpan === 1 && childNodes_withTag(tr, 'TD').length === 2) {
            data = tr.querySelector(":scope > td:nth-child(2)").innerText.remove([" (공통)", " (동일)", / \(각성 Lv\.\d 해방\)$/]).removeAll(["\n"]).replace(/(\d)초/g, '$1').trim(); // (동일), 초 제거
        }
        else {
            return;
        }

        // label 결정
        // 라벨 뒤에 "(공통)"이 있으면 따로 빼놓기
        if(label_pure.endsWith(" (공통)")) {
            dup_data[label_pure] = data;
            return;
        }

        // 라벨 뒤에 숫자에 따라서 현재 라벨 숫자 업데이트
        const match = label_pure.match(/\d$/);
        if (match) {
            label_num = match[0];
            label = label_pure;
        }
        // 라벨 뒤에 숫자는 없지만, 숫자를 붙이고 싶지 않은 경우. "원본 레어 스킬" 등
        else if (label_num_except_list.includes(label_pure)) {
            label = label_pure;
        }
        else {
            label = label_pure + ` ${label_num}`;
        }

        //스킬 Pt 소비량일 경우 누적값으로 변경
        if (label_pure === "스킬 Pt 소비량") {
            data = sum_skillPt(data);
        }

        skill_data[label] = data;
    })

    //최종 label_num 만큼 "(공통)" 조건을 집어넣기
    for (const key in dup_data) {
        for (let i=1; i<=label_num; i++) {
            const label = key.replace(" (공통)", ` ${i}`)
            skill_data[label] = dup_data[key];
        }
    }

    return skill_data;
}


function skill_name_juicer(skill_name_divs) {
    const result = [];

    skill_name_divs.forEach((skill_name_div, index) => {
        const skill_data = {};

        const full_skill_name = skill_name_div.querySelector("strong").innerText.trim();
        const matches = full_skill_name.match(/^\[(.+?)\]\s*(.+?)(?:\s*\((\S+?)\))?$/);

        // 추출된 결과
        skill_data['희귀'] = (matches[1] === "노멀" && page_category === "고유") ? "계승" : matches[1]; // 고유
        skill_data['스킬명(나무)'] = matches[2].trim(); // 블루 로즈 체이서
        skill_data['스킬명(일섭)'] = matches[3] || matches[2].trim(); // 괄호가 없으면 일섭명과 한섭명이 같은 경우

        result.push(skill_data);
    });

    return result;
}

// 딕셔너리의 value를 separator로 count만큼 쪼개서 딕셔너리 배열로 분할.
function split_dictionary(dict, count, separator=" / ") {
    const result = [];

    //count개 만큼의 딕셔너리를 생성
    for (let i=0; i<count; i++) {
        const split_dict = {};

        for (const label in dict) {
            const split_data_arr = dict[label].split(separator);

            // count 이상 쪼개지면 i번째를 담음.
            if (split_data_arr.length >= count) {
                split_dict[label] = split_data_arr[i];
            }
            // 안쪼개지면 그대로 담음.
            else {
                split_dict[label] = dict[label];
            }
        }
        result.push(split_dict);
    }

    return result;
}

//두 딕셔너리 배열을 하나로 합침.
function mergeDictionaries(dictArray1, dictArray2) {
    // 결과를 저장할 빈 배열 초기화
    let result = [];

    // 두 개의 딕셔너리 배열을 순회하면서 합치기
    for (let i = 0; i < dictArray1.length && i < dictArray2.length; i++) {
        // 같은 인덱스의 딕셔너리 병합
        let mergedDict = Object.assign({}, dictArray1[i], dictArray2[i]);
        // 결과 배열에 추가
        result.push(mergedDict);
    }

    return result;
}

// 사전에 sheetName에 해당하는 배열이 없으면 생성 및 push
function pushArray(dict, sheetName, array) {
    if (dict[sheetName] === undefined) {
        dict[sheetName] = [...array];
    }
    else {
        dict[sheetName].push(...array);
    }
}


//각 n주년 패치때의 데이터를 가진 delta spreadsheet 반환
function create_delta_spreadsheet() {
    const skill_spreadsheet_delta = {}; // 현재, 3주년 전, 2주년 전, 1.5주년 전, 1주년 전...

    const skill_td_array = document.querySelectorAll("div:nth-child(2) > div > div > div > div > table > tbody > tr > td[colspan='2']:has(strong)");
    skill_td_array.forEach(skill_td => {
        const skill_tbody = skill_td.parentNode.parentNode;
        const skill_name_divs = skill_td.querySelectorAll(":scope > div:has(strong)");

        //tbody를 넣으면 스킬 수만큼 쪼개서 딕셔너리 배열로 반환.
        const sheetName = "현재";
        const skill_data_array = split_dictionary(tbody_juicer(skill_tbody), skill_name_divs.length);
        const skill_name_array = skill_name_juicer(skill_name_divs)
        const skill_info_array = mergeDictionaries(skill_name_array, skill_data_array);
        pushArray(skill_spreadsheet_delta, sheetName, skill_info_array);

        // n주년 전 tbody들
        const before_patch_tbody_array = skill_tbody.querySelectorAll("table > tbody:has(> tr:nth-child(2))");
        before_patch_tbody_array.forEach(tbody =>{
            const pureText = tbody.closest("dl:has(> dt)").querySelector(":scope > dt").innerText.trim();
            const patch_year = pureText.match(/(\d+(?:\.\d)?)주년/)[1];
            const before_patch_sheetName = `${patch_year}주년 전`
            const before_patch_skill_data_array = split_dictionary(tbody_juicer(tbody), skill_name_divs.length);
            const before_patch_skill_info_array = mergeDictionaries(skill_name_array, before_patch_skill_data_array);
            pushArray(skill_spreadsheet_delta, before_patch_sheetName, before_patch_skill_info_array);
        });
    });

    //console.table(skill_spreadsheet_delta);
    return skill_spreadsheet_delta;
}

// 값 복사
function dataCopy(original) {
    return JSON.parse(JSON.stringify(original));
}

// 키값으로 딕셔너리 정렬
function sortDict(dict) {
    let sortedKeys = Object.keys(dict).sort((a, b) => {
        // "현재"를 가장 처음으로 정렬
        if (a === "현재") return -1;
        if (b === "현재") return 1;

        // 숫자 부분을 추출하여 내림차순으로 정렬
        let numA = parseFloat(a.match(/\d+(\.\d)?/)[0]);
        let numB = parseFloat(b.match(/\d+(\.\d)?/)[0]);
        return numB - numA;


    });
    let sortedDict = {};
    sortedKeys.forEach(key => {
        sortedDict[key] = dict[key];
    });
    return sortedDict;
}

//ss : 딕셔너리. {현재:[], 3주년:[],...}
//sheet : 딕셔너리 배열. [{스킬명:skill1, 효과:value1},{스킬명:skill2, 효과:value2}...]
//skill_info : 딕셔너리. {스킬명:skill1, 효과:value1, ...}

//sheet_delta의 스킬을 sheet에서 찾아서 dataCopy
function applyPatch(sheet, sheet_delta) {
    sheet_delta.forEach(skill_info => {
        const index = sheet.findIndex(v => v['희귀'] === skill_info['희귀'] && v['스킬명(나무)'] === skill_info['스킬명(나무)']);
        if (index !== -1) {
            if ("원본 레어 스킬 1" in sheet[index] && !("원본 레어 스킬 1" in skill_info)) {
                skill_info['원본 레어 스킬 1'] = sheet[index]['원본 레어 스킬 1'];
            }
            sheet[index] = dataCopy(skill_info);
        }
    });
}

// delta spreadsheet를 full spreadsheet로 변환
function create_full_spreadsheet(ss_delta) {
    const ss_full = {};
    ss_delta = sortDict(ss_delta);
    const sheetNames = Object.keys(ss_delta);

    for (let i=0; i < sheetNames.length; i++) {
        let before_sheetName = sheetNames[i-1];
        let current_sheetName = sheetNames[i];
        //let next_sheetName = sheetNames[i+1];
        console.log(`${current_sheetName}`);

        // 1번째. "현재"
        if (before_sheetName === undefined) {
            ss_full[current_sheetName] = dataCopy(ss_delta[current_sheetName]);
        }
        // 2번째 ~ n번째
        else {
            ss_full[current_sheetName] = dataCopy(ss_full[before_sheetName]); //이전 시트 복사해오기
            applyPatch(ss_full[current_sheetName], ss_delta[current_sheetName]); // 패치 적용
        }
    }

    return ss_full;
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

function downloadTSVs() {
    const ss_full = create_full_spreadsheet(create_delta_spreadsheet());
    for (const sheet in ss_full) {
        downloadDictionaryArrayAsTSV(ss_full[sheet], `${page_category} ${sheet}`);
    }


}


(function() {
    'use strict';

    // Your code here...
    GM_registerMenuCommand("다운로드",downloadTSVs);
})();