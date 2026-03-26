-- liquibase formatted sql

-- =============================================
-- Content DB — Initial Schema
-- Tennis Wire
-- =============================================

-- changeset andrei:1
-- comment: Enable uuid-ossp extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- changeset andrei:2
-- comment: Create enum types for articles, tags, and media
CREATE TYPE article_type AS ENUM ('news', 'article');
CREATE TYPE article_status AS ENUM ('draft', 'published');
CREATE TYPE tag_type AS ENUM ('player', 'tournament', 'organization', 'topic', 'section');
CREATE TYPE media_type AS ENUM ('image', 'video', 'audio');

-- changeset andrei:3
-- comment: Create articles table
CREATE TABLE articles (
                          id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                          type                article_type NOT NULL,
                          status              article_status NOT NULL DEFAULT 'draft',

    -- Основной контент
                          title               VARCHAR(500) NOT NULL,
                          subtitle            TEXT,
                          slug                VARCHAR(500) NOT NULL UNIQUE,
                          content             TEXT,
                          cover_image_url     VARCHAR(2000),
                          reading_time        INTEGER,

    -- Атрибуция
                          source_url          VARCHAR(2000),
                          source_name         VARCHAR(300),
                          author_id           UUID,

    -- Агрегатор (на будущее)
                          aggregator_item_id  VARCHAR(255),
                          source_language     VARCHAR(10),
                          parsed_at           TIMESTAMPTZ,

    -- Временные метки
                          published_at        TIMESTAMPTZ,
                          created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                          updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- changeset andrei:4
-- comment: Create indexes for articles table
CREATE INDEX idx_articles_type ON articles (type);
CREATE INDEX idx_articles_status ON articles (status);
CREATE INDEX idx_articles_published_at ON articles (published_at DESC);
CREATE INDEX idx_articles_author_id ON articles (author_id);
CREATE INDEX idx_articles_aggregator_item_id ON articles (aggregator_item_id)
    WHERE aggregator_item_id IS NOT NULL;

-- changeset andrei:5
-- comment: Create tags table with section-specific fields
CREATE TABLE tags (
                      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                      name            VARCHAR(200) NOT NULL UNIQUE,
                      slug            VARCHAR(200) NOT NULL UNIQUE,
                      type            tag_type NOT NULL DEFAULT 'topic',

    -- Поля для type='section' (nullable для остальных типов)
                      description     TEXT,
                      icon            VARCHAR(100),
                      sort_order      INTEGER DEFAULT 0,
                      is_active       BOOLEAN DEFAULT TRUE,

                      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tags_type ON tags (type);
CREATE INDEX idx_tags_slug ON tags (slug);
CREATE INDEX idx_tags_section_sort ON tags (sort_order) WHERE type = 'section';

-- changeset andrei:6
-- comment: Create article_tags junction table (M2M)
CREATE TABLE article_tags (
                              article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
                              tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                              PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX idx_article_tags_tag_id ON article_tags (tag_id);

-- changeset andrei:7
-- comment: Create related_articles junction table (M2M)
CREATE TABLE related_articles (
                                  article_id          UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
                                  related_article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
                                  sort_order          INTEGER NOT NULL DEFAULT 0,
                                  PRIMARY KEY (article_id, related_article_id),
                                  CONSTRAINT chk_no_self_reference CHECK (article_id != related_article_id)
    );

CREATE INDEX idx_related_articles_related ON related_articles (related_article_id);

-- changeset andrei:8
-- comment: Create media table for S3/MinIO file registry
CREATE TABLE media (
                       id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                       type                media_type NOT NULL,
                       url                 VARCHAR(2000) NOT NULL,
                       original_filename   VARCHAR(500),
                       mime_type           VARCHAR(100),
                       size_bytes          BIGINT,
                       width               INTEGER,
                       height              INTEGER,
                       duration_seconds    INTEGER,
                       uploaded_by         UUID,
                       created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_type ON media (type);
CREATE INDEX idx_media_uploaded_by ON media (uploaded_by);

-- changeset andrei:9 splitStatements:false
-- comment: Create trigger for auto-updating updated_at on articles
-- rollback: DROP TRIGGER IF EXISTS trigger_articles_updated_at ON articles; DROP FUNCTION IF EXISTS update_updated_at_column();
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_articles_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- changeset andrei:10 context:seed
-- comment: Insert initial tags - players, tournaments, organizations, topics, sections
INSERT INTO tags (name, slug, type, description, icon, sort_order) VALUES
                                                                       -- Sections (тематические разделы)
                                                                       ('Треш-зона', 'trash', 'section', 'Кринж, скандалы, мемы и всё самое дикое из мира тенниса', '🗑️', 1),

                                                                       -- ATP Players
                                                                       ('Новак Джокович', 'novak-djokovic', 'player', NULL, NULL, NULL),
                                                                       ('Карлос Алькарас', 'carlos-alcaraz', 'player', NULL, NULL, NULL),
                                                                       ('Янник Синнер', 'jannik-sinner', 'player', NULL, NULL, NULL),
                                                                       ('Даниил Медведев', 'daniil-medvedev', 'player', NULL, NULL, NULL),
                                                                       ('Александр Зверев', 'alexander-zverev', 'player', NULL, NULL, NULL),

                                                                       -- WTA Players
                                                                       ('Арина Соболенко', 'aryna-sabalenka', 'player', NULL, NULL, NULL),
                                                                       ('Ига Швёнтек', 'iga-swiatek', 'player', NULL, NULL, NULL),
                                                                       ('Коко Гофф', 'coco-gauff', 'player', NULL, NULL, NULL),
                                                                       ('Елена Рыбакина', 'elena-rybakina', 'player', NULL, NULL, NULL),

                                                                       -- Grand Slams
                                                                       ('Australian Open', 'australian-open', 'tournament', NULL, NULL, NULL),
                                                                       ('Roland Garros', 'roland-garros', 'tournament', NULL, NULL, NULL),
                                                                       ('Wimbledon', 'wimbledon', 'tournament', NULL, NULL, NULL),
                                                                       ('US Open', 'us-open', 'tournament', NULL, NULL, NULL),
                                                                       ('ATP Finals', 'atp-finals', 'tournament', NULL, NULL, NULL),
                                                                       ('WTA Finals', 'wta-finals', 'tournament', NULL, NULL, NULL),

                                                                       -- Organizations
                                                                       ('ATP', 'atp', 'organization', NULL, NULL, NULL),
                                                                       ('WTA', 'wta', 'organization', NULL, NULL, NULL),
                                                                       ('ITF', 'itf', 'organization', NULL, NULL, NULL),

                                                                       -- Topics
                                                                       ('Травмы', 'injuries', 'topic', NULL, NULL, NULL),
                                                                       ('Трансферы', 'transfers', 'topic', NULL, NULL, NULL),
                                                                       ('Рейтинг', 'rankings', 'topic', NULL, NULL, NULL),
                                                                       ('Допинг', 'doping', 'topic', NULL, NULL, NULL),
                                                                       ('Интервью', 'interview', 'topic', NULL, NULL, NULL);
