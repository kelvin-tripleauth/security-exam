import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  GraduationCap,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { examData } from "./data/examData";

type MainTab = "terms" | "written" | "practical";
type Term = (typeof examData.terms)[number];
type WrittenQuestion = (typeof examData.written)[number]["questions"][number];
type PracticalQuestion = (typeof examData.practical)[number]["questions"][number];

const mainTabs: Array<{ id: MainTab; label: string; icon: typeof BookOpen }> = [
  { id: "terms", label: "핵심용어", icon: BookOpen },
  { id: "written", label: "필기", icon: FileQuestion },
  { id: "practical", label: "실기", icon: GraduationCap },
];

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[()\[\]{}.,:;'"“”‘’·\s-]/g, "")
    .trim();

const termHighlightSeeds = [
  "기밀성",
  "무결성",
  "가용성",
  "인증",
  "암호화",
  "복호화",
  "대칭키",
  "비대칭키",
  "전자서명",
  "해시함수",
  "접근 권한",
  "고가용성",
  "백도어",
  "트랩도어",
  "프로토콜",
  "전자상거래",
  "웹 브라우저",
  "웹 서버",
  "침입",
  "탐지",
  "개인정보",
  "위험",
  "취약점",
  "패스워드",
  "악성코드",
  "루트킷",
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getTermKeywords = (term: Term) => {
  const text = `${term.title} ${term.description}`;
  const titleBase = term.title.replace(/\([^)]*\)/g, "").trim();
  const parenthetical = [...term.title.matchAll(/\(([^)]+)\)/g)].map((match) => match[1].trim());
  const acronyms = text.match(/\b(?:[A-Z0-9]{2,}(?:[-/][A-Z0-9]+)*|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g) ?? [];
  return [...new Set([titleBase, ...parenthetical, ...acronyms, ...termHighlightSeeds])]
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length >= 2 && text.includes(keyword))
    .sort((a, b) => b.length - a.length);
};

const renderHighlightedText = (text: string, keywords: string[]) => {
  if (keywords.length === 0) return text;
  const keywordPattern = new RegExp(`(${keywords.map(escapeRegExp).join("|")})`, "gi");
  return text.split(keywordPattern).map((part, index) => {
    const isKeyword = keywords.some((keyword) => keyword.toLowerCase() === part.toLowerCase());
    return isKeyword ? <strong key={`${part}-${index}`}>{part}</strong> : part;
  });
};

const isPracticalCorrect = (input: string, answer: string) => {
  const normalizedInput = normalize(input);
  const normalizedAnswer = normalize(answer);
  if (!normalizedInput || !normalizedAnswer || normalizedAnswer.includes("해설참조")) {
    return false;
  }
  if (normalizedInput === normalizedAnswer) {
    return true;
  }
  const answerParts = answer
    .split(/[,/]|(?:\ba\s*:)|(?:\bb\s*:)|(?:\bc\s*:)|(?:\bd\s*:)|(?:ㄱ\s*:)|(?:ㄴ\s*:)/i)
    .map(normalize)
    .filter((part) => part.length >= 2);
  return answerParts.length > 0 && answerParts.every((part) => normalizedInput.includes(part));
};

function App() {
  const [activeTab, setActiveTab] = useState<MainTab>("terms");
  const [writtenRound, setWrittenRound] = useState(1);
  const [practicalRound, setPracticalRound] = useState(1);
  const [termQuery, setTermQuery] = useState("");
  const [selectedTermId, setSelectedTermId] = useState<number>(examData.terms[0].id);
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>({});
  const [practicalAnswers, setPracticalAnswers] = useState<Record<string, string>>({});
  const [checkedPractical, setCheckedPractical] = useState<Record<string, boolean>>({});

  const filteredTerms = useMemo(() => {
    const query = normalize(termQuery);
    if (!query) return examData.terms;
    return examData.terms.filter(
      (term) => normalize(term.title).includes(query) || normalize(term.description).includes(query),
    );
  }, [termQuery]);

  useEffect(() => {
    if (filteredTerms.length > 0 && !filteredTerms.some((term) => term.id === selectedTermId)) {
      setSelectedTermId(filteredTerms[0].id);
    }
  }, [filteredTerms, selectedTermId]);

  const selectedTerm =
    filteredTerms.find((term) => term.id === selectedTermId) ?? filteredTerms[0] ?? examData.terms[0];

  const selectedWritten = examData.written.find((round) => round.round === writtenRound) ?? examData.written[0];
  const selectedPractical =
    examData.practical.find((round) => round.round === practicalRound) ?? examData.practical[0];

  const writtenStats = useMemo(() => {
    const answered = selectedWritten.questions.filter((question) => writtenAnswers[question.id]).length;
    const correct = selectedWritten.questions.filter(
      (question) => writtenAnswers[question.id] === question.answer,
    ).length;
    return { answered, correct, total: selectedWritten.questions.length };
  }, [selectedWritten, writtenAnswers]);

  const practicalStats = useMemo(() => {
    const checked = selectedPractical.questions.filter((question) => checkedPractical[question.id]).length;
    const correct = selectedPractical.questions.filter((question) =>
      isPracticalCorrect(practicalAnswers[question.id] ?? "", question.answer),
    ).length;
    return { checked, correct, total: selectedPractical.questions.length };
  }, [selectedPractical, practicalAnswers, checkedPractical]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">정보보안기사</p>
          <h1>시험대비 문제풀이</h1>
        </div>
        <div className="source-pill">
          <ShieldCheck size={18} />
          <span>PDF 기반 학습 세트</span>
        </div>
      </header>

      <nav className="main-tabs" aria-label="학습 영역">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "tab-button active" : "tab-button"}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <main>
        {activeTab === "terms" && (
          <section className="study-section">
            <div className="section-head">
              <div>
                <p className="eyebrow">108개 핵심용어</p>
                <h2>목록에서 고르고, 한 번에 하나씩 읽으세요</h2>
              </div>
              <label className="search-box">
                <Search size={18} />
                <input
                  value={termQuery}
                  onChange={(event) => setTermQuery(event.target.value)}
                  placeholder="용어 또는 설명 검색"
                />
              </label>
            </div>
            <TermsReader
              terms={filteredTerms}
              selectedTerm={selectedTerm}
              onSelectTerm={setSelectedTermId}
            />
          </section>
        )}

        {activeTab === "written" && (
          <QuestionSection
            title="필기 기출문제"
            subtitle={`${selectedWritten.title} · 객관식 100문항`}
            rounds={examData.written.map((round) => round.round)}
            activeRound={writtenRound}
            onRoundChange={setWrittenRound}
            stats={`${writtenStats.correct}/${writtenStats.answered || 0} 정답 · ${writtenStats.total}문항`}
            onReset={() => {
              const next = { ...writtenAnswers };
              selectedWritten.questions.forEach((question) => delete next[question.id]);
              setWrittenAnswers(next);
            }}
          >
            <div className="question-list">
              {selectedWritten.questions.map((question) => (
                <WrittenQuestionCard
                  key={question.id}
                  question={question}
                  selected={writtenAnswers[question.id]}
                  onSelect={(label) =>
                    setWrittenAnswers((current) => ({ ...current, [question.id]: label }))
                  }
                />
              ))}
            </div>
          </QuestionSection>
        )}

        {activeTab === "practical" && (
          <QuestionSection
            title="실기 기출문제"
            subtitle={`${selectedPractical.title} · 단답/서술형`}
            rounds={examData.practical.map((round) => round.round)}
            activeRound={practicalRound}
            onRoundChange={setPracticalRound}
            stats={`${practicalStats.correct}/${practicalStats.checked || 0} 자동 정답 · ${practicalStats.total}문항`}
            onReset={() => {
              const nextAnswers = { ...practicalAnswers };
              const nextChecked = { ...checkedPractical };
              selectedPractical.questions.forEach((question) => {
                delete nextAnswers[question.id];
                delete nextChecked[question.id];
              });
              setPracticalAnswers(nextAnswers);
              setCheckedPractical(nextChecked);
            }}
          >
            <div className="question-list">
              {selectedPractical.questions.map((question) => (
                <PracticalQuestionCard
                  key={question.id}
                  question={question}
                  value={practicalAnswers[question.id] ?? ""}
                  checked={Boolean(checkedPractical[question.id])}
                  onChange={(value) =>
                    setPracticalAnswers((current) => ({ ...current, [question.id]: value }))
                  }
                  onCheck={() =>
                    setCheckedPractical((current) => ({ ...current, [question.id]: true }))
                  }
                />
              ))}
            </div>
          </QuestionSection>
        )}
      </main>
    </div>
  );
}

function TermsReader({
  terms,
  selectedTerm,
  onSelectTerm,
}: {
  terms: readonly Term[];
  selectedTerm: Term;
  onSelectTerm: (id: number) => void;
}) {
  const selectedIndex = terms.findIndex((term) => term.id === selectedTerm.id);
  const hasTerms = terms.length > 0;
  const paragraphs = selectedTerm.description.split(/\n+/).filter(Boolean);
  const keywords = getTermKeywords(selectedTerm);

  const moveSelection = (direction: -1 | 1) => {
    if (!hasTerms) return;
    const nextIndex = Math.min(Math.max(selectedIndex + direction, 0), terms.length - 1);
    onSelectTerm(terms[nextIndex].id);
  };

  if (!hasTerms) {
    return (
      <div className="term-empty">
        <strong>검색 결과가 없습니다.</strong>
        <span>다른 용어 또는 설명 키워드로 다시 검색하세요.</span>
      </div>
    );
  }

  return (
    <div className="term-workspace">
      <aside className="term-index-panel" aria-label="핵심용어 목록">
        <div className="term-index-summary">
          <strong>{terms.length}</strong>
          <span>개 용어</span>
        </div>
        <div className="term-index-list">
          {terms.map((term) => (
            <button
              key={term.id}
              className={term.id === selectedTerm.id ? "term-index-item active" : "term-index-item"}
              type="button"
              onClick={() => onSelectTerm(term.id)}
            >
              <span>{String(term.id).padStart(3, "0")}</span>
              <strong>{term.title}</strong>
            </button>
          ))}
        </div>
      </aside>

      <article className="term-reader" aria-live="polite">
        <div className="term-reader-kicker">핵심용어 {String(selectedTerm.id).padStart(3, "0")}</div>
        <h3>{selectedTerm.title}</h3>
        <div className="term-reader-body">
          {paragraphs.map((paragraph, index) => (
            <p key={`${selectedTerm.id}-${index}`}>{renderHighlightedText(paragraph, keywords)}</p>
          ))}
        </div>
        <div className="term-reader-actions">
          <button type="button" onClick={() => moveSelection(-1)} disabled={selectedIndex <= 0}>
            <ChevronLeft size={18} />
            <span>이전</span>
          </button>
          <span>
            {selectedIndex + 1} / {terms.length}
          </span>
          <button type="button" onClick={() => moveSelection(1)} disabled={selectedIndex >= terms.length - 1}>
            <span>다음</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </article>
    </div>
  );
}

function QuestionSection({
  title,
  subtitle,
  rounds,
  activeRound,
  onRoundChange,
  stats,
  onReset,
  children,
}: {
  title: string;
  subtitle: string;
  rounds: readonly number[];
  activeRound: number;
  onRoundChange: (round: number) => void;
  stats: string;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="study-section">
      <div className="section-head compact">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <div className="score-panel">
          <strong>{stats}</strong>
          <button className="icon-action" type="button" onClick={onReset} aria-label="현재 회차 답안 초기화">
            <RotateCcw size={17} />
          </button>
        </div>
      </div>
      <div className="round-tabs" aria-label="회차 선택">
        {rounds.map((round) => (
          <button
            key={round}
            className={activeRound === round ? "round-tab active" : "round-tab"}
            type="button"
            onClick={() => onRoundChange(round)}
          >
            {round}회
          </button>
        ))}
      </div>
      {children}
    </section>
  );
}

function WrittenQuestionCard({
  question,
  selected,
  onSelect,
}: {
  question: WrittenQuestion;
  selected?: string;
  onSelect: (label: string) => void;
}) {
  const isAnswered = Boolean(selected);
  const isCorrect = selected === question.answer;
  return (
    <article className="question-card">
      <div className="question-meta">
        <span>{String(question.number).padStart(2, "0")}</span>
        <span>{question.subject}</span>
      </div>
      <h3>{question.question}</h3>
      <div className="option-list">
        {question.options.map((option) => {
          const selectedOption = selected === option.label;
          const correctOption = isAnswered && question.answer === option.label;
          return (
            <button
              key={option.label}
              className={[
                "option-button",
                selectedOption ? "selected" : "",
                correctOption ? "correct" : "",
                selectedOption && !isCorrect ? "wrong" : "",
              ].join(" ")}
              onClick={() => onSelect(option.label)}
              type="button"
            >
              <span>{option.label}</span>
              <p>{option.text}</p>
            </button>
          );
        })}
      </div>
      {isAnswered && (
        <AnswerPanel correct={isCorrect} answer={question.answer} explanation={question.explanation} />
      )}
    </article>
  );
}

function PracticalQuestionCard({
  question,
  value,
  checked,
  onChange,
  onCheck,
}: {
  question: PracticalQuestion;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  onCheck: () => void;
}) {
  const correct = checked && isPracticalCorrect(value, question.answer);
  return (
    <article className="question-card">
      <div className="question-meta">
        <span>{String(question.number).padStart(2, "0")}</span>
        <span>실기</span>
      </div>
      <h3>{question.question}</h3>
      <div className="short-answer-row">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="답안을 입력하세요"
        />
        <button type="button" onClick={onCheck}>
          채점
        </button>
      </div>
      {checked && <AnswerPanel correct={correct} answer={question.answer} explanation={question.explanation} />}
    </article>
  );
}

function AnswerPanel({
  correct,
  answer,
  explanation,
}: {
  correct: boolean;
  answer: string;
  explanation: string;
}) {
  return (
    <div className={correct ? "answer-panel correct" : "answer-panel wrong"}>
      <div className="answer-result">
        {correct ? <CheckCircle2 size={19} /> : <XCircle size={19} />}
        <strong>{correct ? "정답입니다" : "오답입니다"}</strong>
        <span>정답: {answer}</span>
      </div>
      <p>{explanation}</p>
    </div>
  );
}

export default App;
