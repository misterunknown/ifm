<template>
  <footer v-if="store.tasks.length > 0" class="footer ifm-tasks mt-auto py-3">
    <div class="container">
      <div class="row">
        <div class="col-md-2 mb-1">
          <button type="button" class="btn btn-light w-100" @click="store.tasksExpanded = !store.tasksExpanded">
            {{ t('tasks') }} <span class="badge bg-secondary">{{ store.tasks.length }}</span>
          </button>
        </div>
        <div id="waitqueue" class="col-md-10" :class="{ expanded: store.tasksExpanded }">
          <div v-for="task in store.tasks" :key="task.id" class="card mb-1">
            <div class="card-body p-2">
              <div class="progress">
                <div
                  class="progress-bar task-progress-bar bg-info progress-bar-striped"
                  :class="{ 'progress-bar-animated': task.progress == null }"
                  role="progressbar"
                  :aria-valuenow="Math.round(task.progress ?? 100)"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :style="task.progress != null ? { width: task.progress + '%' } : undefined"
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

<script setup lang="ts">
import { store } from '../store'
import { t } from '../i18n'
</script>
