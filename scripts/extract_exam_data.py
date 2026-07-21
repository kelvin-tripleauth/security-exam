import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "security-exam-reference.pdf"
OUT_PATH = ROOT / "src" / "data" / "examData.ts"

CHOICE_LABELS = ["①", "②", "③", "④"]
SUBJECTS = [
    "1과목 시스템 보안",
    "2과목 네트워크 보안",
    "3과목 애플리케이션 보안",
    "4과목 정보보안 일반",
    "5과목 정보보안 관리 및 법규",
]


def extract_pages(pdf, start_page, end_page):
    pages = []
    for page_no in range(start_page, end_page + 1):
        text = pdf.pages[page_no - 1].extract_text(x_tolerance=1, y_tolerance=3) or ""
        pages.append(text)
    return "\n".join(pages)


def extract_pages_by_columns(pdf, start_page, end_page):
    pages = []
    for page_no in range(start_page, end_page + 1):
        page = pdf.pages[page_no - 1]
        midpoint = page.width / 2
        for box in [(0, 0, midpoint, page.height), (midpoint, 0, page.width, page.height)]:
            text = page.crop(box).extract_text(x_tolerance=1, y_tolerance=3) or ""
            pages.append(text)
    return "\n".join(pages)


def clean_common(text):
    lines = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line == "또기적 합격자료집":
            continue
        if line.startswith("정보보안기사 필기+실기 올인원"):
            continue
        if line.startswith("필기 최신 기출문제 정답 & 해설"):
            continue
        if line in {"필기 최신 기출문", "문제 정답 & 해설"}:
            continue
        lines.append(line)
    return "\n".join(lines)


def squeeze(text):
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def is_complete_korean_sentence(text):
    return bool(re.search(r"(다|됨|함|음|임|있음|없음)\.(?:\([^)]*\))?$", text.strip()))


def looks_like_term_diagram_line(line):
    line = line.strip()
    if not line:
        return True
    if len(line) <= 3 and not is_complete_korean_sentence(line):
        return True
    diagram_tokens = [
        "Message",
        "Massage",
        "Client",
        "Server",
        "Backdoor",
        "Packet",
        "Tunneling",
        "Change Cipher",
        "Root CA",
        "Plan Do Check",
        "Service Call",
        "HTTP Request",
        "Web Server",
        "Ticket",
        "Sniffer",
        "Sequence",
        "Login",
        "Password",
        "Injection",
        "Spoofing",
        "DWDM",
        "Fiber Channel",
    ]
    if any(token in line for token in diagram_tokens):
        return True
    if re.search(r"\b[A-Z][A-Za-z0-9/-]*\b.*\b[A-Z][A-Za-z0-9/-]*\b", line) and len(line) <= 80:
        return True
    if len(line) <= 45 and not is_complete_korean_sentence(line):
        return True
    return False


def join_term_lines(lines):
    text = ""
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if not text:
            text = line
        elif text.endswith("-"):
            text = text[:-1] + line
        elif text.endswith("/") or text.endswith("S/"):
            text += line
        else:
            text += " " + line
    replacements = {
        "프로토 콜": "프로토콜",
        "메커 니즘": "메커니즘",
        "컴퓨 터": "컴퓨터",
        "방 법": "방법",
        "시 스템": "시스템",
        "네트 워크": "네트워크",
        "암호 알고리즘": "암호알고리즘",
        "암호 화": "암호화",
        "파악 한다": "파악한다",
        "있 으며": "있으며",
        "사이에 서": "사이에서",
        "마음대 로": "마음대로",
        "S/ MIME": "S/MIME",
        "Mu- tual": "Mutual",
        "Ac- cess": "Access",
    }
    for before, after in replacements.items():
        text = text.replace(before, after)
    text = re.sub(r"\s+([,.])", r"\1", text)
    return squeeze(text)


def clean_term_description(raw_description):
    lines = [line.strip() for line in raw_description.splitlines() if line.strip()]
    kept = []
    for line in lines:
        current = join_term_lines(kept)
        if kept and is_complete_korean_sentence(current) and looks_like_term_diagram_line(line):
            break
        kept.append(line)
    return join_term_lines(kept)


def parse_terms(raw):
    text = clean_common(raw)
    text = re.sub(r"^핵심 용어 108선\s*", "", text)
    matches = list(re.finditer(r"(?m)^(\d{1,3})\.\s+(.+)$", text))
    terms = []
    for idx, match in enumerate(matches):
        number = int(match.group(1))
        title = match.group(2).strip()
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        description = clean_term_description(text[start:end])
        if number <= 108:
            terms.append({"id": number, "title": title, "description": description})
    return terms


def clean_written_questions(text):
    text = clean_common(text)
    text = re.sub(r"필기 최신 기출문제 \d{2}회", "", text)
    text = re.sub(r"답안 표기란", "", text)
    text = re.sub(r"\b\d{2,3}\s+①\s+②\s+③\s+④\b", "", text)
    for subject in SUBJECTS:
        text = text.replace(subject, f"\n{subject}\n")
    return squeeze(text)


def subject_for_question(number):
    return SUBJECTS[min((number - 1) // 20, 4)]


def parse_written_questions(raw, answers, explanations, round_no):
    text = clean_written_questions(raw)
    starts = list(re.finditer(r"(?m)^(\d{2,3})\s+(.+)", text))
    questions = []
    for idx, start in enumerate(starts):
        number = int(start.group(1))
        if number < 1 or number > 100:
            continue
        end = starts[idx + 1].start() if idx + 1 < len(starts) else len(text)
        block = text[start.start():end].strip()
        block = re.sub(r"^\d{2,3}\s+", "", block)
        for subject in SUBJECTS:
            block = block.replace(subject, "")
        option_positions = list(re.finditer(r"[①②③④]", block))
        if len(option_positions) < 4:
            question_text = squeeze(block)
            options = []
        else:
            question_text = squeeze(block[: option_positions[0].start()])
            options = []
            for option_idx, option_match in enumerate(option_positions[:4]):
                option_end = (
                    option_positions[option_idx + 1].start()
                    if option_idx + 1 < 4
                    else len(block)
                )
                option_text = squeeze(block[option_match.end() : option_end])
                option_text = re.sub(r"^\s*[:.)]\s*", "", option_text)
                options.append({"label": CHOICE_LABELS[option_idx], "text": option_text})
        answer = answers.get(number, "")
        explanation = explanations.get(number)
        if not explanation:
            explanation = (
                "PDF 답안표에 정답없음으로 표기되어 있습니다."
                if answer == "정답없음"
                else f"PDF 답안표 기준 정답은 {answer}입니다."
            )
        questions.append(
            {
                "id": f"written-{round_no}-{number}",
                "number": number,
                "subject": subject_for_question(number),
                "question": question_text,
                "options": options,
                "answer": answer,
                "explanation": explanation,
            }
        )
    deduped = {}
    for question in questions:
        deduped[question["number"]] = question
    return [deduped[number] for number in sorted(deduped)]


def parse_written_answers(raw):
    text = clean_common(raw)
    answer_by_round = {}
    explanation_by_round = {}
    markers = list(re.finditer(r"(?m)^(\d{2})회 필기 최신 기출문제", text))
    for idx, marker in enumerate(markers):
        round_no = int(marker.group(1))
        start = marker.start()
        end = markers[idx + 1].start() if idx + 1 < len(markers) else len(text)
        section = text[start:end]

        answers = {}
        for num_text, label in re.findall(r"\b(100|\d{2})\s*(정답없음|[①②③④])\b", section):
            number = int(num_text)
            if 1 <= number <= 100 and number not in answers:
                answers[number] = label
            if len(answers) == 100:
                break
        answer_by_round[round_no] = answers

        explanation_text = section
        subject_match = re.search(r"\n1과목\s+시스템 보안", section)
        if subject_match:
            explanation_text = section[subject_match.start() :]
        explanation_matches = list(re.finditer(r"(?<!\d)(100|\d{2})\s+(정답없음|[①②③④])", explanation_text))
        explanations = {}
        for ex_idx, ex_match in enumerate(explanation_matches):
            number = int(ex_match.group(1))
            if not (1 <= number <= 100):
                continue
            ex_start = ex_match.end()
            ex_end = (
                explanation_matches[ex_idx + 1].start()
                if ex_idx + 1 < len(explanation_matches)
                else len(explanation_text)
            )
            explanation = squeeze(explanation_text[ex_start:ex_end])
            if explanation and (number not in explanations or len(explanation) > len(explanations[number])):
                explanations[number] = explanation
        explanation_by_round[round_no] = explanations
    return answer_by_round, explanation_by_round


def clean_practical(text):
    text = clean_common(text)
    text = re.sub(r"실기 최신 기출문제 \d{2}회", "", text)
    text = re.sub(r"^\d{2}\s+(단답형|서술형|실무형)$", "", text, flags=re.MULTILINE)
    return squeeze(text)


def parse_practical_round(raw, round_no):
    text = clean_practical(raw)
    candidates = list(re.finditer(r"(?m)^(0[1-9]|1[0-9]|20)\s+(.+)", text))
    starts = []
    expected = 1
    for candidate in candidates:
        number = int(candidate.group(1))
        if number == expected:
            starts.append(candidate)
            expected += 1

    items = []
    for idx, start in enumerate(starts):
        number = int(start.group(1))
        end = starts[idx + 1].start() if idx + 1 < len(starts) else len(text)
        block = text[start.start():end].strip()
        block = re.sub(r"^\d{2}\s+", "", block)
        explanation = ""
        answer = ""
        question = block
        if "\n해설\n" in block:
            question, rest = block.split("\n해설\n", 1)
            if "\n정답\n" in rest:
                explanation, answer = rest.rsplit("\n정답\n", 1)
            else:
                explanation = rest
        elif "\n정답\n" in block:
            question, answer = block.rsplit("\n정답\n", 1)
            explanation = answer
        cleaned_answer = squeeze(answer) or "해설 참조"
        cleaned_explanation = squeeze(explanation) or cleaned_answer
        items.append(
            {
                "id": f"practical-{round_no}-{number}",
                "number": number,
                "question": squeeze(question),
                "answer": cleaned_answer,
                "explanation": cleaned_explanation,
            }
        )
    return items


def main():
    with pdfplumber.open(PDF_PATH) as pdf:
        terms = parse_terms(extract_pages(pdf, 7, 31))
        written_answers, written_explanations = parse_written_answers(extract_pages_by_columns(pdf, 104, 129))
        written_ranges = {1: (32, 55), 2: (56, 80), 3: (81, 103)}
        written = []
        for round_no, (start, end) in written_ranges.items():
            written.append(
                {
                    "round": round_no,
                    "title": f"{round_no}회 필기 기출문제",
                    "questions": parse_written_questions(
                        extract_pages(pdf, start, end),
                        written_answers.get(round_no, {}),
                        written_explanations.get(round_no, {}),
                        round_no,
                    ),
                }
            )

        practical_ranges = {1: (130, 139), 2: (140, 152), 3: (153, 162)}
        practical = []
        for round_no, (start, end) in practical_ranges.items():
            practical.append(
                {
                    "round": round_no,
                    "title": f"{round_no}회 실기 기출문제",
                    "questions": parse_practical_round(extract_pages(pdf, start, end), round_no),
                }
            )

    data = {"terms": terms, "written": written, "practical": practical}
    summary = {
        "terms": len(terms),
        "written": [len(round_data["questions"]) for round_data in written],
        "writtenAnswers": [sum(1 for q in r["questions"] if q["answer"]) for r in written],
        "practical": [len(round_data["questions"]) for round_data in practical],
    }
    OUT_PATH.write_text(
        "export const examData = "
        + json.dumps(data, ensure_ascii=False, indent=2)
        + " as const;\n\n"
        + "export type ExamData = typeof examData;\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
