"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { z } from "zod";
import { Button } from "@/components/ui/button/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRightIcon } from "@/components/icons";
import { Dialog } from "@/components/ui/dialog";
import { InputForm } from "@/components/ui/input";
import { Form } from "@/components/ui/form";
import veilleService, { VeilleStatus, LlmProvider } from "@/lib/api/veille.service";

const PROVIDERS: LlmProvider[] = ["deepseek", "openai", "anthropic", "ollama"];

const formSchema = z.object({
    subject: z
        .string()
        .min(3, { message: "Le sujet doit faire au moins 3 caractères." }),
    provider: z.enum(["deepseek", "openai", "anthropic", "ollama"]),
    ollamaModel: z.string().optional(),
});

const STATUS_BADGE: Record<VeilleStatus, { label: string; color: "success" | "warning" | "gray" }> = {
    SUCCESS: { label: "Effectué", color: "success" },
    PENDING: { label: "En cours", color: "warning" },
    FAILED: { label: "Échec", color: "gray" },
};

// Affichage lisible du provider LLM (cf. backend /veille/run : deepseek | openai | anthropic | ollama).
const PROVIDER_LABEL: Record<string, string> = {
    deepseek: "DeepSeek",
    openai: "OpenAI",
    anthropic: "Anthropic",
    ollama: "Ollama",
};

function providerLabel(provider: string | null): string {
    if (!provider) return "Modèle inconnu";
    return PROVIDER_LABEL[provider.toLowerCase()] ?? provider;
}

export default function AllMonitoring() {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    const { veilles, error, isLoading, refreshVeilles } = veilleService.useVeilles({ limit: 100 });
    const list = veilles ?? [];

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { subject: "", provider: "deepseek", ollamaModel: "" },
    });

    const selectedProvider = form.watch("provider");

    async function onSubmit(data: z.infer<typeof formSchema>) {
        setSubmitting(true);
        setServerError(null);
        try {
            await veilleService.runVeille(
                data.subject,
                data.provider,
                data.provider === "ollama" ? data.ollamaModel?.trim() || undefined : undefined,
            );
            await refreshVeilles();
            form.reset();
            setOpen(false);
        } catch (e) {
            const message =
                e instanceof Error ? e.message : "Impossible de lancer la veille.";
            setServerError(message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="main-container pt-10 pb-16">
            <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                    <h1 className="text-lg font-semibold">{"Veilles"}</h1>
                    <p className="text-sm mt-1">
                        {"Sessions de veille lancées sur l'écosystème tech."}
                    </p>
                </div>
                <Dialog
                    open={open}
                    onOpenChange={setOpen}
                    trigger={
                        <Button size={"md"} variant="primary">
                            {"Nouvelle veille"}
                        </Button>
                    }
                    title="Nouvelle veille"
                    description="Lancer une veille sur un sujet en rapport avec la tech."
                    content={
                        <div className="py-4">
                            <Form {...form}>
                                <form
                                    onSubmit={form.handleSubmit(onSubmit)}
                                    className="space-y-6"
                                >
                                    <InputForm
                                        control={form.control}
                                        name="subject"
                                        label="Sujet"
                                        placeholder="Ex: Tendances Fintech au Nigeria"
                                        isRequired
                                        size={"md"}
                                    />
                                    <div className="space-y-1.5">
                                        <label htmlFor="veille-provider" className="text-sm font-medium">
                                            {"Modèle LLM"}
                                        </label>
                                        <select
                                            id="veille-provider"
                                            {...form.register("provider")}
                                            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-black/40"
                                        >
                                            {PROVIDERS.map(p => (
                                                <option key={p} value={p}>
                                                    {providerLabel(p)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {selectedProvider === "ollama" && (
                                        <InputForm
                                            control={form.control}
                                            name="ollamaModel"
                                            label="Modèle Ollama (optionnel)"
                                            placeholder="Ex: llama3 — vide = défaut serveur"
                                            size={"md"}
                                        />
                                    )}
                                    {serverError && (
                                        <p className="text-sm text-red-600">{serverError}</p>
                                    )}
                                    <Button type="submit" size={"lg"} className="w-full" disabled={submitting}>
                                        {submitting ? "Lancement..." : "Démarrer la veille"}
                                    </Button>
                                </form>
                            </Form>
                        </div>
                    }
                />
            </div>

            <div className="mt-12 border-t border-black/10">
                {isLoading && (
                    <div className="py-6 px-4 text-sm text-black/60">
                        {"Chargement des veilles..."}
                    </div>
                )}
                {error && (
                    <div className="py-6 px-4 text-sm text-red-600">
                        {"Impossible de charger les veilles."}
                    </div>
                )}
                {!isLoading && !error && list.length === 0 && (
                    <div className="py-6 px-4 text-sm text-black/60">
                        {"Aucune veille lancée pour le moment."}
                    </div>
                )}
                {list.map(veille => {
                    const statusInfo = STATUS_BADGE[veille.status];
                    return (
                        <div key={veille.id} className="border-black/10 border-b py-4 px-4">
                            <div className="flex items-center justify-between gap-10">
                                <div className="w-full">
                                    <span className="font-base block text-sm">
                                        {veille.prompt}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                                        <span
                                            className="text-sm opacity-60"
                                            title={new Date(veille.created_at).toLocaleString("fr-FR")}
                                        >
                                            {formatDistanceToNow(new Date(veille.created_at), {
                                                addSuffix: true,
                                                locale: fr,
                                            })}
                                        </span>
                                        <span className="opacity-30">•</span>
                                        <Badge color="gray">{providerLabel(veille.llm_provider)}</Badge>
                                    </div>
                                </div>
                                <div className="shrink-0 flex items-center gap-6">
                                    <Badge color={statusInfo.color}>{statusInfo.label}</Badge>
                                    <Link
                                        href={`/dashboard/tech-monitoring/one/${veille.id}`}
                                        className="h-6 w-6 shrink-0 flex items-center justify-center"
                                    >
                                        <ChevronRightIcon size={20} />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
