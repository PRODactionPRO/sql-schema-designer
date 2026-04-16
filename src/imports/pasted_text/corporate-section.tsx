Feature = одно действие пользователя или один интерактивный сценарий.
features соединяют entities и shared, но не должны становиться “свалкой всего”.

Типичная структура:

features/some-action/
* ui/   компоненты сценария
* lib/  преобразования, маппинги, вспомогательные функции сценария
* model/ (опционально) локальное состояние сценария, если это не состояние сущности

Правило: feature может зависеть от entities и shared, но не от pages/widgets/app.

Cross-feature import нежелателен.
Если двум фичам нужен общий код, выносить его:
* либо в entities (если это доменная логика)
* либо в shared/lib (если это техническая утилита)
* либо в processes (если это сквозной процесс/пайплайн)

8. widgets/ — композиции для layout
Widget = самодостаточный блок интерфейса для зоны layout, который собирает несколько features/entities, но не добавляет “новую бизнес-логику”.

Создавать widget, если:
* это устойчивый блок UI (sidebar/header/panel), который можно переносить
* он композитит несколько фич

Не создавать widget, если:

* это одна фича (тогда это feature/ui)
* это чистый layout-контейнер страницы без логики (тогда это pages/ui)

9. pages/ — экраны и маршруты
Page = экран, привязанный к URL/маршруту.

pages отвечают за:
* layout страницы
* работу с роутингом (params, navigate)
* композицию widgets/features

* стартовую загрузку/инициализацию данных (через вызовы entities/features, без “бизнес-правил” внутри page)

10. processes/ (опционально)
Использовать, когда появляется сквозной бизнес-процесс, объединяющий несколько фич и состояний.

Пример: “онбординг”, “чекаут”, “мультишаговая регистрация”, где есть сценарий выше уровня одной фичи.

11. Правила импортов и алиасы
* @/ (или другой алиас) использовать для cross-slice импортов
* ./ использовать для внутренних импортов внутри сегмента/слайса
* наружу экспортировать только через index.ts

12. Чеклист “куда положить код”
* UI-примитив без бизнес-логики → shared/ui
* общая утилита → shared/lib
* базовый API-клиент/транспорт → shared/api
* типы/стор/доменные правила → entities/*/model
* представление сущности → entities/*/ui
* пользовательский сценарий → features/*/ui (+ lib/model по необходимости)
* блок layout, композитящий несколько фич → widgets/*/ui
* экран по URL → pages/*/ui
* провайдеры/роутер/инициализация → app

13. Антипаттерны

* импорт во внутренности слайса (минует Public API)
* shared содержит доменную логику
* pages реализует бизнес-правила вместо координации
* feature импортирует feature (без вынесения общего кода вниз/в processes)
* компоненты подписаны на весь Zustand-store вместо селекторов

14. Выноси отдельно компонент со своими стилями в отельную папку, то есть в папке будет компонент и рядом файл с его стилями. Пример: 
"use client";

import { useState } from "react";
import { CorporateCard } from "@/entities/corporate";
import { CorporateRequestForm } from "@/features/corporate-request-form";
import { cn } from "@/shared/lib/utils";
import { Button, ResponsiveModal, Typography } from "@/shared/ui";
import { corporatePrograms } from "../model/data";
import styles from "./styles.module.css";

interface Props {
  className?: string;
}

export const CorporateSection = ({ className }: Props) => {
  const [isRequestOpen, setIsRequestOpen] = useState(false);

  return (
    <section
      id="corporate"
      className={cn(styles.section, "layout-container", className)}
    >
      <div className={styles.head}>
        <Typography type="h2" className="mb-4">
          Корпоративные путешествия / MICE
        </Typography>
        <Typography>
          Организуем выезды для команд: тимбилдинги, стратегические сессии,
          incentive-туры. Помогаем компаниям находить новые смыслы в совместных
          путешествиях.
        </Typography>
      </div>

      <div className={styles.grid}>
        {corporatePrograms.map((program) => (
          <CorporateCard key={program.id} {...program} />
        ))}
      </div>