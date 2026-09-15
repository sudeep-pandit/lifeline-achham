"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Rnd } from "react-rnd";
import { apiFetch, downloadPdf, ApiError } from "../../../../../lib/api-client";
import { Card } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Select } from "../../../../../components/ui/select";
import type {
  DocumentTemplateDto,
  DocumentTemplateKind,
  TemplateElement,
  TemplateFieldKey,
  SaveDocumentTemplateRequest,
  MemberListItemDto,
} from "@lifeline/types";

const CANVAS: Record<DocumentTemplateKind, { width: number; height: number; label: string }> = {
  CARD: { width: 485, height: 306, label: "ID Card (front/back, standard size)" },
  CERTIFICATE: { width: 700, height: 495, label: "Certificate (A4 landscape)" },
};

const FIELD_OPTIONS: { key: TemplateFieldKey; label: string }[] = [
  { key: "memberName", label: "Member Name" },
  { key: "memberId", label: "Member ID" },
  { key: "membershipType", label: "Membership Type" },
  { key: "membershipDate", label: "Membership Date" },
  { key: "validUntil", label: "Valid Until" },
  { key: "cardNumber", label: "Card Number" },
  { key: "certificateNumber", label: "Certificate Number" },
  { key: "issueDate", label: "Issue Date" },
  { key: "orgName", label: "Organization Name" },
  { key: "bloodGroup", label: "Blood Group" },
  { key: "photo", label: "Member Photo" },
  { key: "orgLogo", label: "Organization Logo" },
  { key: "qr", label: "QR Verification Code" },
  { key: "signature", label: "Signature Line" },
];

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DesignerContent() {
  const params = useSearchParams();
  const router = useRouter();
  const type = (params.get("type") === "CERTIFICATE" ? "CERTIFICATE" : "CARD") as DocumentTemplateKind;
  const canvas = CANVAS[type];

  const [templates, setTemplates] = useState<DocumentTemplateDto[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled template");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [front, setFront] = useState<TemplateElement[]>([]);
  const [back, setBack] = useState<TemplateElement[]>([]);
  const [side, setSide] = useState<"front" | "back">("front");
  const [referenceImageFront, setReferenceImageFront] = useState<string | undefined>();
  const [referenceImageBack, setReferenceImageBack] = useState<string | undefined>();
  const [customFontData, setCustomFontData] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [history, setHistory] = useState<{ front: TemplateElement[]; back: TemplateElement[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const skipHistoryRef = useRef(false);

  const [members, setMembers] = useState<MemberListItemDto[]>([]);
  const [previewMemberId, setPreviewMemberId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const elements = side === "front" ? front : back;
  const setElements = side === "front" ? setFront : setBack;
  const selected = elements.find((e) => e.id === selectedId) ?? null;

  function loadTemplateList() {
    apiFetch<DocumentTemplateDto[]>(`/document-templates?type=${type}`).then(setTemplates).catch(() => {});
  }

  useEffect(() => {
    loadTemplateList();
    apiFetch<{ items: MemberListItemDto[] }>("/members?pageSize=100").then((d) => setMembers(d.items)).catch(() => {});
  }, [type]);

  function resetBlank() {
    setTemplateId(null);
    setName(`Untitled ${type === "CARD" ? "card" : "certificate"} template`);
    setBackgroundColor("#FFFFFF");
    setFront([]);
    setBack([]);
    setReferenceImageFront(undefined);
    setReferenceImageBack(undefined);
    setCustomFontData(undefined);
    setSelectedId(null);
    setHistory([]);
    setHistoryIndex(-1);
  }

  async function loadTemplate(id: string) {
    const t = await apiFetch<DocumentTemplateDto>(`/document-templates/${id}`);
    setTemplateId(t.id);
    setName(t.name);
    setBackgroundColor(t.backgroundColor);
    setFront(t.frontLayout ?? []);
    setBack(t.backLayout ?? []);
    setReferenceImageFront(t.referenceImageFront ?? undefined);
    setReferenceImageBack(t.referenceImageBack ?? undefined);
    setCustomFontData(t.customFontData ?? undefined);
    setSelectedId(null);
    setHistory([{ front: t.frontLayout ?? [], back: t.backLayout ?? [] }]);
    setHistoryIndex(0);
  }

  // Push a history snapshot whenever front/back change, unless we're the
  // ones applying an undo/redo (which would otherwise create a loop).
  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }
    setHistory((h) => {
      const trimmed = h.slice(0, historyIndex + 1);
      return [...trimmed, { front, back }];
    });
    setHistoryIndex((i) => i + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [front, back]);

  function undo() {
    if (historyIndex <= 0) return;
    skipHistoryRef.current = true;
    const prev = history[historyIndex - 1];
    setFront(prev.front);
    setBack(prev.back);
    setHistoryIndex(historyIndex - 1);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    skipHistoryRef.current = true;
    const next = history[historyIndex + 1];
    setFront(next.front);
    setBack(next.back);
    setHistoryIndex(historyIndex + 1);
  }

  function addElement(kind: TemplateElement["kind"], extra: Partial<TemplateElement> = {}) {
    const el: TemplateElement = {
      id: newId(),
      kind,
      x: 30, y: 30, width: 30, height: 12,
      rotation: 0,
      zIndex: elements.length + 1,
      fontFamily: "regular",
      fontSize: 12,
      color: "#1B2233",
      align: "left",
      ...extra,
    };
    setElements([...elements, el]);
    setSelectedId(el.id);
  }

  function updateElement(id: string, patch: Partial<TemplateElement>) {
    setElements(elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function deleteElement(id: string) {
    setElements(elements.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function duplicateElement(id: string) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    const copy = { ...el, id: newId(), x: el.x + 3, y: el.y + 3, zIndex: elements.length + 1 };
    setElements([...elements, copy]);
    setSelectedId(copy.id);
  }

  function moveLayer(id: string, direction: "up" | "down" | "front" | "back") {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    const maxZ = Math.max(0, ...elements.map((e) => e.zIndex));
    const minZ = Math.min(0, ...elements.map((e) => e.zIndex));
    const newZ = direction === "up" ? el.zIndex + 1 : direction === "down" ? el.zIndex - 1 : direction === "front" ? maxZ + 1 : minZ - 1;
    updateElement(id, { zIndex: newZ });
  }

  async function handleImageUpload(file: File, onDone: (dataUrl: string) => void) {
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      setError("Please upload a JPG or PNG image");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("Image must be under 3MB");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    onDone(dataUrl);
  }

  async function handleFontUpload(file: File) {
    if (!file.name.endsWith(".ttf") && !file.name.endsWith(".otf")) {
      setError("Please upload a .ttf or .otf font file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Font file must be under 5MB");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setCustomFontData(dataUrl);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: SaveDocumentTemplateRequest = {
        type, name, backgroundColor,
        frontLayout: front,
        backLayout: type === "CARD" ? back : undefined,
        referenceImageFront, referenceImageBack, customFontData,
      };
      const saved = templateId
        ? await apiFetch<DocumentTemplateDto>(`/document-templates/${templateId}`, { method: "PATCH", body: JSON.stringify(body) })
        : await apiFetch<DocumentTemplateDto>("/document-templates", { method: "POST", body: JSON.stringify(body) });
      setTemplateId(saved.id);
      loadTemplateList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save this template.");
    } finally {
      setSaving(false);
    }
  }

  async function setAsDefault() {
    if (!templateId) return;
    await apiFetch(`/document-templates/${templateId}/set-default`, { method: "PATCH", body: JSON.stringify({}) });
    loadTemplateList();
  }

  async function duplicateTemplate() {
    if (!templateId) return;
    const copy = await apiFetch<DocumentTemplateDto>(`/document-templates/${templateId}/duplicate`, { method: "POST", body: JSON.stringify({}) });
    loadTemplateList();
    loadTemplate(copy.id);
  }

  async function deleteTemplate() {
    if (!templateId) return;
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    try {
      await apiFetch(`/document-templates/${templateId}`, { method: "DELETE" });
      loadTemplateList();
      resetBlank();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to delete this template.");
    }
  }

  async function preview() {
    if (!templateId) {
      setError("Save the template first, then preview it.");
      return;
    }
    if (!previewMemberId) {
      setError("Pick a member to preview with their real data.");
      return;
    }
    setPreviewing(true);
    setError(null);
    try {
      const path = type === "CARD" ? "membership-cards" : "certificates";
      await downloadPdf(`/documents/${path}/${previewMemberId}/pdf?templateId=${templateId}`, "preview.pdf");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to generate a preview.");
    } finally {
      setPreviewing(false);
    }
  }

  const referenceImage = side === "front" ? referenceImageFront : referenceImageBack;
  const setReferenceImage = side === "front" ? setReferenceImageFront : setReferenceImageBack;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-navy dark:text-paper">
            {type === "CARD" ? "ID Card" : "Certificate"} Designer
          </h1>
          <p className="text-sm text-navy-400 dark:text-navy-100">{canvas.label}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.push(`/dashboard/documents/designer?type=${type === "CARD" ? "CERTIFICATE" : "CARD"}`)}>
            Switch to {type === "CARD" ? "Certificates" : "ID Cards"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[220px_1fr_260px] gap-4">
        {/* Templates list */}
        <Card className="flex flex-col gap-2 p-3">
          <Button onClick={resetBlank} className="mb-1">+ New template</Button>
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => loadTemplate(t.id)}
              className={`rounded px-2 py-2 text-left text-sm ${templateId === t.id ? "bg-navy-50 font-medium text-navy dark:bg-navy-600 dark:text-paper" : "text-navy-400 hover:bg-navy-50 dark:text-navy-100 dark:hover:bg-navy-600"}`}
            >
              {t.name} {t.isDefault && <span className="text-xs text-sage">• default</span>}
            </button>
          ))}
        </Card>

        {/* Canvas */}
        <Card className="flex flex-col items-center gap-3 p-4">
          {type === "CARD" && (
            <div className="flex gap-2">
              <Button variant={side === "front" ? "primary" : "secondary"} onClick={() => setSide("front")}>Front</Button>
              <Button variant={side === "back" ? "primary" : "secondary"} onClick={() => setSide("back")}>Back</Button>
            </div>
          )}

          <div
            className="relative overflow-hidden border border-navy-100 dark:border-navy-600"
            style={{ width: canvas.width, height: canvas.height, backgroundColor }}
            onMouseDown={() => setSelectedId(null)}
          >
            {referenceImage && (
              <img src={referenceImage} alt="Reference guide" className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-30" />
            )}
            {[...elements].sort((a, b) => a.zIndex - b.zIndex).map((el) => (
              <Rnd
                key={el.id}
                size={{ width: (el.width / 100) * canvas.width, height: (el.height / 100) * canvas.height }}
                position={{ x: (el.x / 100) * canvas.width, y: (el.y / 100) * canvas.height }}
                disableDragging={el.locked}
                enableResizing={!el.locked}
                style={{ display: el.hidden ? "none" : undefined, zIndex: el.zIndex }}
                onDragStop={(_, d) => updateElement(el.id, { x: (d.x / canvas.width) * 100, y: (d.y / canvas.height) * 100 })}
                onResizeStop={(_, __, ref, ___, pos) =>
                  updateElement(el.id, {
                    width: (ref.offsetWidth / canvas.width) * 100,
                    height: (ref.offsetHeight / canvas.height) * 100,
                    x: (pos.x / canvas.width) * 100,
                    y: (pos.y / canvas.height) * 100,
                  })
                }
                onMouseDown={(e: any) => { e.stopPropagation(); setSelectedId(el.id); }}
                bounds="parent"
              >
                <div
                  className={`h-full w-full ${selectedId === el.id ? "outline outline-2 outline-crimson" : "outline outline-1 outline-navy-100/50"}`}
                  style={{ transform: `rotate(${el.rotation}deg)`, backgroundColor: el.kind === "shape" && el.shapeType !== "line" ? el.fillColor : undefined }}
                >
                  {el.kind === "text" && (
                    <span style={{ fontSize: el.fontSize, color: el.color, textAlign: el.align as any, display: "block" }}>{el.text}</span>
                  )}
                  {el.kind === "field" && (
                    <span className="flex h-full w-full items-center justify-center bg-navy-50/60 text-xs text-navy-400 dark:bg-navy-600/60 dark:text-navy-100">
                      {FIELD_OPTIONS.find((f) => f.key === el.field)?.label ?? el.field}
                    </span>
                  )}
                  {el.kind === "image" && el.imageData && (
                    <img src={el.imageData} alt="" className="h-full w-full object-contain" />
                  )}
                </div>
              </Rnd>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={undo} disabled={historyIndex <= 0}>Undo</Button>
            <Button variant="secondary" onClick={redo} disabled={historyIndex >= history.length - 1}>Redo</Button>
            <label className="cursor-pointer rounded border border-navy-100 px-3 py-2 text-sm text-navy-400 hover:border-crimson hover:text-crimson dark:border-navy-400 dark:text-navy-100">
              Upload reference image
              <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], setReferenceImage)} />
            </label>
            {referenceImage && <button onClick={() => setReferenceImage(undefined)} className="text-xs text-crimson underline">Remove reference</button>}
          </div>
        </Card>

        {/* Inspector */}
        <Card className="flex flex-col gap-3 p-3">
          <div>
            <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Template name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Background color</label>
            <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-9 w-full rounded border border-navy-100" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-navy-400 dark:text-navy-100">Custom font (Nepali/Devanagari)</label>
            <label className="block cursor-pointer rounded border border-navy-100 px-3 py-2 text-center text-sm text-navy-400 hover:border-crimson hover:text-crimson dark:border-navy-400 dark:text-navy-100">
              {customFontData ? "Replace .ttf/.otf" : "Upload .ttf/.otf"}
              <input type="file" accept=".ttf,.otf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFontUpload(e.target.files[0])} />
            </label>
          </div>

          <div className="border-t border-navy-100 pt-3 dark:border-navy-600">
            <p className="mb-2 text-sm font-medium text-navy dark:text-paper">Add element</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => addElement("text", { text: "Custom text" })}>+ Text</Button>
              <Button variant="secondary" onClick={() => addElement("shape", { shapeType: "rectangle", fillColor: "#1B2A4A" })}>+ Shape</Button>
              <label className="cursor-pointer rounded border border-navy-100 px-3 py-1.5 text-sm text-navy-400 dark:border-navy-400 dark:text-navy-100">
                + Image
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], (d) => addElement("image", { imageData: d, width: 20, height: 20 }))} />
              </label>
            </div>
            <div className="mt-2">
              <Select onChange={(e) => { if (e.target.value) { addElement("field", { field: e.target.value as TemplateFieldKey, width: 30, height: 8 }); e.target.value = ""; } }}>
                <option value="">+ Dynamic field…</option>
                {FIELD_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </Select>
            </div>
          </div>

          {selected && (
            <div className="border-t border-navy-100 pt-3 dark:border-navy-600">
              <p className="mb-2 text-sm font-medium text-navy dark:text-paper">Selected element</p>
              <div className="flex flex-col gap-2">
                {(selected.kind === "text") && (
                  <>
                    <Input value={selected.text ?? ""} onChange={(e) => updateElement(selected.id, { text: e.target.value })} placeholder="Text" />
                    <div className="flex gap-2">
                      <Select value={selected.fontFamily} onChange={(e) => updateElement(selected.id, { fontFamily: e.target.value as any })}>
                        <option value="regular">Regular</option>
                        <option value="bold">Bold</option>
                        {customFontData && <option value="custom">Custom (Nepali)</option>}
                      </Select>
                      <Input type="number" value={selected.fontSize} onChange={(e) => updateElement(selected.id, { fontSize: Number(e.target.value) })} className="w-20" />
                    </div>
                    <input type="color" value={selected.color} onChange={(e) => updateElement(selected.id, { color: e.target.value })} className="h-9 w-full rounded border border-navy-100" />
                    <Select value={selected.align} onChange={(e) => updateElement(selected.id, { align: e.target.value as any })}>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </Select>
                  </>
                )}
                {selected.kind === "shape" && (
                  <>
                    <Select value={selected.shapeType} onChange={(e) => updateElement(selected.id, { shapeType: e.target.value as any })}>
                      <option value="rectangle">Rectangle</option>
                      <option value="line">Line</option>
                      <option value="circle">Circle</option>
                    </Select>
                    <label className="text-xs text-navy-400 dark:text-navy-100">Fill color</label>
                    <input type="color" value={selected.fillColor ?? "#1B2A4A"} onChange={(e) => updateElement(selected.id, { fillColor: e.target.value })} className="h-9 w-full rounded border border-navy-100" />
                    <label className="text-xs text-navy-400 dark:text-navy-100">Border color</label>
                    <input type="color" value={selected.borderColor ?? "#000000"} onChange={(e) => updateElement(selected.id, { borderColor: e.target.value })} className="h-9 w-full rounded border border-navy-100" />
                  </>
                )}
                <label className="text-xs text-navy-400 dark:text-navy-100">Rotation (degrees)</label>
                <Input type="number" value={selected.rotation} onChange={(e) => updateElement(selected.id, { rotation: Number(e.target.value) })} />

                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Button variant="secondary" onClick={() => moveLayer(selected.id, "front")}>Bring to front</Button>
                  <Button variant="secondary" onClick={() => moveLayer(selected.id, "back")}>Send to back</Button>
                  <Button variant="secondary" onClick={() => updateElement(selected.id, { locked: !selected.locked })}>{selected.locked ? "Unlock" : "Lock"}</Button>
                  <Button variant="secondary" onClick={() => updateElement(selected.id, { hidden: !selected.hidden })}>{selected.hidden ? "Show" : "Hide"}</Button>
                  <Button variant="secondary" onClick={() => duplicateElement(selected.id)}>Duplicate</Button>
                  <Button variant="danger" onClick={() => deleteElement(selected.id)}>Delete</Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {error && <p className="text-crimson">{error}</p>}

      <Card className="flex flex-wrap items-center gap-3">
        <Button disabled={saving} onClick={save}>{saving ? "Saving…" : templateId ? "Save changes" : "Save template"}</Button>
        {templateId && (
          <>
            <Button variant="secondary" onClick={setAsDefault}>Set as default</Button>
            <Button variant="secondary" onClick={duplicateTemplate}>Duplicate</Button>
            <Button variant="danger" onClick={deleteTemplate}>Delete</Button>
            <div className="ml-auto flex items-center gap-2">
              <Select value={previewMemberId} onChange={(e) => setPreviewMemberId(e.target.value)} className="w-56">
                <option value="">Preview with member…</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.memberId} — {m.fullName}</option>)}
              </Select>
              <Button variant="secondary" disabled={previewing} onClick={preview}>{previewing ? "Generating…" : "Preview PDF"}</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
