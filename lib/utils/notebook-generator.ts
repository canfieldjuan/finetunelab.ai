// Jupyter Notebook Generator for Google Colab
// Purpose: Generate .ipynb format from training code snippets
// Date: 2025-10-20

/**
 * Generate a Jupyter notebook with training code
 */
export function generateTrainingNotebook(
  publicId: string,
  trainingMethod: 'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt'
): string {
  console.log(`[NotebookGenerator] Creating notebook for ${trainingMethod} with ID: ${publicId}`);

  const methodLabels: Record<typeof trainingMethod, string> = {
    sft: 'Supervised Fine-Tuning (SFT)',
    dpo: 'Direct Preference Optimization (DPO)',
    rlhf: 'RLHF Training',
    orpo: 'ORPO Training',
    cpt: 'Continued Pre-Training (CPT)'
  };

  const notebookTitle = `FineTune Lab - ${methodLabels[trainingMethod]}`;

  const installCell = {
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: [
      '# Install FineTune Lab training loader\n',
      '!pip install finetune-lab-loader'
    ]
  };

  const trainingCell = {
    cell_type: 'code',
    execution_count: null,
    metadata: {},
    outputs: [],
    source: [
      `# Run ${methodLabels[trainingMethod]}\n`,
      `from finetune_lab import train_${trainingMethod}\n`,
      '\n',
      `train_${trainingMethod}("${publicId}")`
    ]
  };

  const notebook = {
    nbformat: 4,
    nbformat_minor: 0,
    metadata: {
      colab: {
        name: notebookTitle,
        provenance: []
      },
      kernelspec: {
        name: 'python3',
        display_name: 'Python 3'
      },
      language_info: {
        name: 'python'
      }
    },
    cells: [installCell, trainingCell]
  };

  const notebookJson = JSON.stringify(notebook, null, 2);
  console.log(`[NotebookGenerator] Generated notebook (${notebookJson.length} bytes)`);

  return notebookJson;
}

/**
 * Get filename for notebook
 */
export function getNotebookFilename(trainingMethod: 'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt'): string {
  return `finetune_lab_${trainingMethod}.ipynb`;
}

console.log('[NotebookGenerator] Notebook generator utilities loaded');
