<!-- Background-task footer replacing templates footer.html + task.html.
  Appears with the first task, disappears with the last (legacy task_add/done).
  showAll toggles the expanded queue (legacy maxHeight 6rem <-> 70vh). -->
<template>
    <footer v-if="store.state.tasks.length" class="footer mt-auto py-3">
        <div id="wq_container" class="container">
            <div class="row">
                <div class="col-md-2 mb-1">
                    <button type="button" class="btn btn-light w-100" name="showAll" @click="expanded = !expanded">
                        {{ store.t('tasks') }}
                        <span class="badge bg-secondary" name="taskCount">{{ store.state.tasks.length }}</span>
                    </button>
                </div>
                <div id="waitqueue" class="col-md-10" :class="{ expanded }">
                    <div v-for="task in store.state.tasks" :key="task.id" :id="`wq-${task.id}`" class="card mb-1">
                        <div class="card-body">
                            <div class="progress">
                                <div
                                    class="progress-bar task-progress-bar"
                                    :class="`bg-${task.type}`"
                                    role="progressbar"
                                    :aria-valuenow="task.progress"
                                    aria-valuemax="100"
                                    :style="{ width: task.progress + '%' }"
                                >
                                    {{ task.name }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </footer>
</template>

<script setup>
import { inject, ref } from 'vue';

const store = inject('store');
const expanded = ref(false);
</script>
