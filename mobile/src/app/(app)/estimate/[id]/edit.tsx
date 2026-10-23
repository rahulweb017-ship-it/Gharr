import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EstimateInput } from "@/shared/contracts/estimate";
import { estimateApi } from "~/api/endpoints";
import { EstimateForm, type EstimateFormInitial } from "~/components/EstimateForm";
import { ErrorView, Loading } from "~/components/ui";

export default function EditEstimateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const estimate = useQuery({ queryKey: ["estimate", id], queryFn: () => estimateApi.get(id) });
  const update = useMutation({
    mutationFn: (input: EstimateInput) => estimateApi.update(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(["estimate", id], updated);
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["estimate", id, "boq"] });
      router.back();
    },
  });

  if (estimate.isPending) return <Loading />;
  if (estimate.isError) return <ErrorView error={estimate.error} onRetry={estimate.refetch} />;

  return (
    <EstimateForm
      initial={estimate.data.inputs as EstimateFormInitial}
      saveLabel="Recalculate and save"
      saving={update.isPending}
      onSave={update.mutateAsync}
    />
  );
}
