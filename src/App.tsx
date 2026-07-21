import { useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  FileQuestion,
  GraduationCap,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { examData } from "./data/examData";

type MainTab = "terms" | "written" | "practical";
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
                <h2>개념을 빠르게 훑고 검색하세요</h2>
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
            <div className="term-grid">
              {filteredTerms.map((term) => (
                <article className="term-card" key={term.id}>
                  <div className="term-number">{String(term.id).padStart(3, "0")}</div>
                  <h3>{term.title}</h3>
                  <p>{term.description}</p>
                </article>
              ))}
            </div>
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
