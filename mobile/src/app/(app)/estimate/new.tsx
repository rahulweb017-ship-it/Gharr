import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EstimateInput } from "@/shared/contracts/estimate";
import { estimateApi } from "~/api/endpoints";
import { EstimateForm } from "~/components/EstimateForm";

export default function NewEstimateScreen() {
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: (input: EstimateInput) => estimateApi.create(input),
    onSuccess: (estimate) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.setQueryData(["estimate", estimate.id], estimate);
      router.replace({ pathname: "/estimate/[id]", params: { id: estimate.id } });
    },
  });
  return <EstimateForm saveLabel="Save estimate" saving={create.isPending} onSave={create.mutateAsync} />;
}
