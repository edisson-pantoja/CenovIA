// ============================================================
// Currículo Escolar Brasileiro (MEC / BNCC) — fonte de verdade do CenovIA
// Usado pelo mobile (onboarding) e pelo backend (prompt da professora)
// ============================================================

export type SchoolStage = 'ef_iniciais' | 'ef_finais' | 'em';
export type StudentGender = 'feminino' | 'masculino';

export interface SchoolGrade {
  id: string;          // 'ef1' ... 'ef9', 'em1' ... 'em3'
  label: string;       // '1º Ano', '2ª Série'
  stage: SchoolStage;
  level: 'fundamental' | 'medio';
  idealAge: number;    // idade ideal pelo corte do MEC
}

export interface CurriculumTheme {
  tema: string;
  subtemas: string[];
}

// ── 1. Ano escolar × idade ideal (corte do MEC) ─────────────────────────────

export const SCHOOL_GRADES: SchoolGrade[] = [
  { id: 'ef1', label: '1º Ano', stage: 'ef_iniciais', level: 'fundamental', idealAge: 6 },
  { id: 'ef2', label: '2º Ano', stage: 'ef_iniciais', level: 'fundamental', idealAge: 7 },
  { id: 'ef3', label: '3º Ano', stage: 'ef_iniciais', level: 'fundamental', idealAge: 8 },
  { id: 'ef4', label: '4º Ano', stage: 'ef_iniciais', level: 'fundamental', idealAge: 9 },
  { id: 'ef5', label: '5º Ano', stage: 'ef_iniciais', level: 'fundamental', idealAge: 10 },
  { id: 'ef6', label: '6º Ano', stage: 'ef_finais', level: 'fundamental', idealAge: 11 },
  { id: 'ef7', label: '7º Ano', stage: 'ef_finais', level: 'fundamental', idealAge: 12 },
  { id: 'ef8', label: '8º Ano', stage: 'ef_finais', level: 'fundamental', idealAge: 13 },
  { id: 'ef9', label: '9º Ano', stage: 'ef_finais', level: 'fundamental', idealAge: 14 },
  { id: 'em1', label: '1ª Série', stage: 'em', level: 'medio', idealAge: 15 },
  { id: 'em2', label: '2ª Série', stage: 'em', level: 'medio', idealAge: 16 },
  { id: 'em3', label: '3ª Série', stage: 'em', level: 'medio', idealAge: 17 },
];

export const STAGE_LABELS: Record<SchoolStage, string> = {
  ef_iniciais: 'Ensino Fundamental I (Anos Iniciais)',
  ef_finais: 'Ensino Fundamental II (Anos Finais)',
  em: 'Ensino Médio',
};

// ── 2. Grade curricular obrigatória (MEC/BNCC) ──────────────────────────────

export const STAGE_SUBJECTS: Record<SchoolStage, string[]> = {
  ef_iniciais: [
    'Língua Portuguesa', 'Matemática', 'Ciências', 'Geografia', 'História',
    'Arte', 'Educação Física', 'Ensino Religioso',
  ],
  ef_finais: [
    'Língua Portuguesa', 'Matemática', 'Ciências', 'Geografia', 'História',
    'Língua Inglesa', 'Arte', 'Educação Física', 'Ensino Religioso',
  ],
  em: [
    'Língua Portuguesa', 'Matemática', 'Biologia', 'Física', 'Química',
    'História', 'Geografia', 'Filosofia', 'Sociologia', 'Língua Inglesa',
    'Arte', 'Educação Física',
  ],
};

// ── 3. Temas e subtemas por matéria e ano (eixos da BNCC) ───────────────────
// Chave: matéria → id do ano (ou id da etapa, quando o conteúdo é por etapa)

type ThemeMap = Record<string, CurriculumTheme[]>;

const T = (tema: string, ...subtemas: string[]): CurriculumTheme => ({ tema, subtemas });

const CURRICULUM: Record<string, ThemeMap> = {
  'Matemática': {
    ef1: [
      T('Números até 100', 'Contagem e leitura de números', 'Comparar e ordenar quantidades', 'Números no dia a dia'),
      T('Adição e subtração', 'Juntar e acrescentar', 'Retirar e comparar', 'Probleminhas com objetos'),
      T('Geometria e localização', 'Figuras planas e sólidos no cotidiano', 'Direita, esquerda, frente e atrás'),
      T('Grandezas e medidas', 'Maior, menor, mais pesado, mais leve', 'Calendário e dias da semana', 'Cédulas e moedas'),
      T('Tabelas e gráficos simples', 'Ler e montar tabelas', 'Gráficos de colunas com figuras'),
    ],
    ef2: [
      T('Sistema de numeração decimal', 'Números até 1.000', 'Unidade, dezena e centena', 'Par e ímpar'),
      T('Adição e subtração', 'Cálculo com reagrupamento ("vai um")', 'Cálculo mental', 'Problemas do dia a dia'),
      T('Ideias de multiplicação e divisão', 'Dobro e triplo', 'Metade e terça parte', 'Repartir igualmente'),
      T('Geometria', 'Figuras planas e espaciais', 'Esboço de trajetos e mapas simples'),
      T('Medidas', 'Metro e centímetro', 'Quilograma e litro', 'Horas e duração de eventos'),
    ],
    ef3: [
      T('Números até 10.000', 'Leitura, escrita e composição', 'Arredondamento e estimativa'),
      T('Quatro operações', 'Tabuada', 'Multiplicação e divisão', 'Problemas com várias etapas'),
      T('Noções de fração', 'Metade, terça, quarta e quinta parte', 'Frações em situações do cotidiano'),
      T('Geometria', 'Sólidos e planificações', 'Figuras planas: lados e vértices'),
      T('Grandezas e medidas', 'Comprimento, massa e capacidade', 'Tempo: horas e minutos', 'Sistema monetário'),
      T('Estatística', 'Tabelas de dupla entrada', 'Gráficos de barras'),
    ],
    ef4: [
      T('Números naturais', 'Até centenas de milhar', 'Valor posicional', 'Sequências numéricas'),
      T('Multiplicação e divisão', 'Algoritmos', 'Divisão exata e com resto', 'Problemas de proporção'),
      T('Frações e decimais', 'Frações unitárias', 'Décimos e centésimos', 'Decimais no dinheiro'),
      T('Geometria', 'Ângulos retos', 'Simetria', 'Localização em malhas'),
      T('Grandezas e medidas', 'Perímetro e área por contagem', 'Temperatura'),
      T('Probabilidade e estatística', 'Chances de um evento', 'Gráficos e tabelas'),
    ],
    ef5: [
      T('Números naturais e decimais', 'Até milhões', 'Comparação e ordenação de decimais'),
      T('Frações e porcentagem', 'Frações equivalentes', 'Comparação de frações', '10%, 25%, 50% e 100%'),
      T('Operações', 'Operações com decimais', 'Proporcionalidade', 'Problemas de várias etapas'),
      T('Geometria', 'Plano cartesiano (1º quadrante)', 'Polígonos', 'Ampliação e redução de figuras'),
      T('Grandezas e medidas', 'Área e perímetro', 'Volume com cubinhos'),
      T('Probabilidade e estatística', 'Resultados possíveis', 'Leitura e construção de gráficos'),
    ],
    ef6: [
      T('Números naturais', 'Múltiplos e divisores', 'Números primos', 'MMC e MDC'),
      T('Frações e decimais', 'Operações com frações', 'Operações com decimais', 'Porcentagem'),
      T('Geometria', 'Ângulos', 'Polígonos', 'Prismas e pirâmides', 'Plano cartesiano'),
      T('Grandezas e medidas', 'Área e perímetro', 'Volume', 'Conversão de unidades'),
      T('Estatística', 'Pesquisas e coleta de dados', 'Gráficos e tabelas'),
    ],
    ef7: [
      T('Números inteiros e racionais', 'Números negativos', 'Reta numérica', 'Operações com inteiros'),
      T('Razão e proporção', 'Grandezas proporcionais', 'Regra de três', 'Porcentagem e descontos'),
      T('Introdução à álgebra', 'Linguagem algébrica', 'Equações do 1º grau', 'Problemas com equações'),
      T('Geometria', 'Ângulos entre retas paralelas', 'Triângulos: soma dos ângulos', 'Circunferência'),
      T('Medidas e estatística', 'Área de triângulos e quadriláteros', 'Média aritmética', 'Gráfico de setores'),
    ],
    ef8: [
      T('Potências e raízes', 'Propriedades das potências', 'Notação científica', 'Raízes quadradas'),
      T('Álgebra', 'Expressões algébricas', 'Sistemas de equações do 1º grau', 'Equações do tipo ax² = b'),
      T('Geometria', 'Congruência de triângulos', 'Construções geométricas'),
      T('Grandezas e medidas', 'Área do círculo', 'Volume de cilindros'),
      T('Estatística e probabilidade', 'Média, moda e mediana', 'Princípio multiplicativo'),
    ],
    ef9: [
      T('Números reais', 'Números irracionais', 'Potências com expoente fracionário'),
      T('Álgebra', 'Produtos notáveis e fatoração', 'Equação do 2º grau (Bhaskara)', 'Noção de função'),
      T('Geometria', 'Semelhança de triângulos', 'Teorema de Tales', 'Teorema de Pitágoras', 'Relações métricas no triângulo retângulo'),
      T('Grandezas e medidas', 'Volume de prismas e cilindros'),
      T('Estatística, probabilidade e finanças', 'Análise de gráficos', 'Probabilidade', 'Porcentagem e juros'),
    ],
    em1: [
      T('Conjuntos e funções', 'Conjuntos numéricos', 'Conceito de função', 'Gráficos'),
      T('Função afim', 'Coeficientes', 'Crescimento e decrescimento', 'Problemas'),
      T('Função quadrática', 'Vértice e raízes', 'Máximos e mínimos', 'Gráfico (parábola)'),
      T('Funções exponencial e logarítmica', 'Equações exponenciais', 'Logaritmos e propriedades'),
      T('Sequências', 'Progressão aritmética (PA)', 'Progressão geométrica (PG)'),
    ],
    em2: [
      T('Trigonometria', 'Triângulo retângulo', 'Ciclo trigonométrico', 'Funções trigonométricas'),
      T('Matrizes e sistemas', 'Matrizes', 'Determinantes', 'Sistemas lineares'),
      T('Análise combinatória e probabilidade', 'Princípio fundamental da contagem', 'Arranjos, permutações e combinações', 'Probabilidade'),
      T('Geometria espacial', 'Prismas e pirâmides', 'Cilindros, cones e esferas'),
    ],
    em3: [
      T('Geometria analítica', 'Ponto e distância', 'Equação da reta', 'Circunferência'),
      T('Estatística', 'Medidas de tendência central', 'Desvio padrão', 'Interpretação de gráficos'),
      T('Matemática financeira', 'Porcentagem', 'Juros simples e compostos'),
      T('Números complexos e polinômios', 'Forma algébrica', 'Equações polinomiais'),
      T('Revisão para o ENEM', 'Resolução de questões', 'Estratégias de prova'),
    ],
  },

  'Língua Portuguesa': {
    ef1: [
      T('Alfabetização', 'Alfabeto: letras e sons', 'Consciência fonológica (rimas e sílabas)', 'Escrita do próprio nome'),
      T('Leitura inicial', 'Leitura de palavras e frases curtas', 'Parlendas, cantigas e listas'),
      T('Escrita inicial', 'Escrita de palavras', 'Bilhetes e listas'),
      T('Oralidade', 'Contar e recontar histórias', 'Ouvir com atenção'),
    ],
    ef2: [
      T('Alfabetização e fluência', 'Sílabas complexas (lh, nh, ch, rr, ss)', 'Fluência de leitura'),
      T('Escrita', 'Frases e pequenos textos', 'Letra maiúscula e minúscula', 'Pontuação básica'),
      T('Gêneros textuais', 'Contos e fábulas', 'Receitas e convites'),
      T('Compreensão', 'Localizar informações no texto', 'Ilustração e texto'),
    ],
    ef3: [
      T('Ortografia', 'G/GU e C/QU', 'M antes de P e B', 'Acentuação'),
      T('Gramática básica', 'Substantivo', 'Adjetivo', 'Sinônimos e antônimos'),
      T('Produção de textos', 'Narrativas curtas', 'Cartas e bilhetes', 'Parágrafos'),
      T('Interpretação', 'Ideia principal', 'Personagens, tempo e lugar'),
    ],
    ef4: [
      T('Classes de palavras', 'Substantivo e adjetivo', 'Verbo e tempos verbais', 'Pronomes'),
      T('Pontuação', 'Vírgula', 'Dois-pontos e travessão (discurso direto)'),
      T('Gêneros textuais', 'Notícia e relato', 'Poema', 'Verbete'),
      T('Interpretação', 'Inferência', 'Concordância básica'),
    ],
    ef5: [
      T('Gramática', 'Verbos: tempos e modos', 'Advérbios e preposições', 'Acentuação'),
      T('Coesão textual', 'Pronomes para evitar repetição', 'Conectivos'),
      T('Gêneros textuais', 'Reportagem', 'Texto de divulgação científica', 'Crônica'),
      T('Interpretação e produção', 'Fato e opinião', 'Texto com parágrafos'),
    ],
    ef6: [
      T('Morfologia', 'Revisão das classes de palavras', 'Formação de palavras (prefixos e sufixos)'),
      T('Introdução à sintaxe', 'Frase, oração e período'),
      T('Variação linguística', 'Linguagem formal e informal', 'Regionalismos'),
      T('Gêneros textuais', 'Notícia', 'Conto', 'Poema e HQ'),
    ],
    ef7: [
      T('Análise sintática', 'Sujeito e predicado', 'Tipos de sujeito', 'Verbos transitivos e intransitivos'),
      T('Texto e sentido', 'Coesão e coerência', 'Figuras de linguagem'),
      T('Gêneros textuais', 'Reportagem', 'Crônica', 'Textos publicitários'),
    ],
    ef8: [
      T('Análise sintática', 'Objeto direto e indireto', 'Complemento nominal', 'Adjuntos, aposto e vocativo'),
      T('Verbos', 'Vozes verbais (ativa e passiva)'),
      T('Período composto', 'Orações coordenadas'),
      T('Argumentação', 'Artigo de opinião', 'Entrevista', 'Crônica argumentativa'),
    ],
    ef9: [
      T('Período composto por subordinação', 'Orações substantivas', 'Orações adjetivas', 'Orações adverbiais'),
      T('Norma-padrão', 'Concordância e regência', 'Crase', 'Colocação pronominal'),
      T('Gêneros argumentativos', 'Artigo de opinião', 'Editorial', 'Texto dissertativo'),
    ],
    em1: [
      T('Literatura', 'Trovadorismo e Humanismo', 'Classicismo e Quinhentismo', 'Barroco e Arcadismo'),
      T('Gramática', 'Fonologia e ortografia', 'Morfologia'),
      T('Linguagem', 'Funções da linguagem', 'Interpretação de textos'),
      T('Redação', 'Introdução ao texto dissertativo-argumentativo'),
    ],
    em2: [
      T('Literatura', 'Romantismo', 'Realismo e Naturalismo', 'Parnasianismo e Simbolismo'),
      T('Gramática', 'Sintaxe do período simples', 'Sintaxe do período composto'),
      T('Redação ENEM', 'As 5 competências', 'Proposta de intervenção'),
    ],
    em3: [
      T('Literatura', 'Pré-Modernismo', 'Modernismo (fases)', 'Literatura contemporânea'),
      T('Gramática normativa', 'Concordância e regência', 'Crase e colocação pronominal', 'Pontuação'),
      T('Redação ENEM', 'Repertório sociocultural', 'Prática de redação'),
      T('Revisão para vestibulares', 'Interpretação de textos'),
    ],
  },

  'Ciências': {
    ef1: [
      T('Corpo humano', 'Partes do corpo', 'Os cinco sentidos', 'Hábitos de higiene'),
      T('Materiais', 'Do que são feitos os objetos', 'Uso consciente'),
      T('Ritmos da natureza', 'Dia e noite', 'Seres vivos ao nosso redor'),
    ],
    ef2: [
      T('Seres vivos', 'Plantas: partes e necessidades', 'Animais: características'),
      T('Sol e luz', 'Importância do Sol', 'Sombras'),
      T('Materiais', 'Propriedades dos materiais', 'Prevenção de acidentes em casa'),
    ],
    ef3: [
      T('Animais', 'Características e classificação', 'Ciclos de vida'),
      T('Som e luz', 'Produção do som', 'Saúde auditiva e visual'),
      T('Planeta Terra', 'Formato da Terra', 'Solo e água'),
    ],
    ef4: [
      T('Microrganismos', 'Fungos e bactérias', 'Prevenção de doenças'),
      T('Cadeias alimentares', 'Produtores, consumidores e decompositores'),
      T('Misturas e transformações', 'Transformações reversíveis e irreversíveis'),
      T('Terra e céu', 'Pontos cardeais', 'Movimentos da Terra e calendários'),
    ],
    ef5: [
      T('Corpo humano', 'Sistemas digestório, respiratório e circulatório', 'Alimentação saudável'),
      T('Matéria e energia', 'Estados físicos da água', 'Ciclo da água', 'Reciclagem e consumo consciente'),
      T('Astronomia', 'Constelações', 'Fases da Lua', 'Instrumentos ópticos'),
    ],
    ef6: [
      T('Vida', 'Célula como unidade da vida', 'Níveis de organização'),
      T('Corpo humano', 'Sistema nervoso', 'Visão e lentes'),
      T('Introdução à química', 'Misturas homogêneas e heterogêneas', 'Separação de misturas'),
      T('Terra', 'Camadas da Terra', 'Rochas e fósseis'),
    ],
    ef7: [
      T('Física no cotidiano', 'Máquinas simples', 'Calor e temperatura', 'Equilíbrio térmico'),
      T('Ecologia', 'Ecossistemas brasileiros', 'Impactos ambientais'),
      T('Saúde', 'Vacinas e saúde pública'),
      T('Terra e atmosfera', 'Composição do ar', 'Efeito estufa e camada de ozônio', 'Placas tectônicas'),
    ],
    ef8: [
      T('Energia', 'Fontes e tipos de energia', 'Circuitos elétricos', 'Consumo consciente'),
      T('Corpo humano', 'Sistema endócrino', 'Puberdade e sistema reprodutor', 'Prevenção de ISTs'),
      T('Terra e Lua', 'Clima e tempo', 'Estações do ano', 'Eclipses'),
    ],
    ef9: [
      T('Introdução à química', 'Átomo e modelos atômicos', 'Tabela periódica', 'Ligações e reações químicas'),
      T('Introdução à física', 'Ondas e radiações', 'Aplicações tecnológicas'),
      T('Genética e evolução', 'Hereditariedade e Mendel', 'Darwin e seleção natural'),
      T('Universo e sustentabilidade', 'Sistema Solar e galáxias', 'Unidades de conservação'),
    ],
  },

  'Biologia': {
    em1: [
      T('Bioquímica', 'Água e sais minerais', 'Carboidratos, lipídios e proteínas', 'Ácidos nucleicos'),
      T('Citologia', 'Membrana plasmática', 'Organelas', 'Núcleo'),
      T('Divisão celular', 'Mitose', 'Meiose'),
      T('Metabolismo energético', 'Fotossíntese', 'Respiração celular'),
      T('Embriologia e histologia', 'Desenvolvimento embrionário', 'Tecidos'),
    ],
    em2: [
      T('Classificação dos seres vivos', 'Taxonomia', 'Vírus e bactérias', 'Protistas e fungos'),
      T('Botânica', 'Grupos de plantas', 'Fisiologia vegetal'),
      T('Zoologia', 'Invertebrados', 'Vertebrados'),
      T('Fisiologia humana', 'Sistemas do corpo humano'),
    ],
    em3: [
      T('Genética', 'Leis de Mendel', 'Heredogramas e grupos sanguíneos', 'Biotecnologia'),
      T('Evolução', 'Teorias evolutivas', 'Especiação'),
      T('Ecologia', 'Cadeias e teias alimentares', 'Ciclos biogeoquímicos', 'Relações ecológicas', 'Impactos ambientais'),
    ],
  },

  'Física': {
    em1: [
      T('Cinemática', 'MRU e MRUV', 'Queda livre', 'Lançamentos'),
      T('Dinâmica', 'Leis de Newton', 'Atrito e plano inclinado'),
      T('Energia', 'Trabalho e potência', 'Conservação da energia', 'Quantidade de movimento'),
      T('Gravitação e estática', 'Leis de Kepler', 'Hidrostática'),
    ],
    em2: [
      T('Termologia', 'Temperatura e escalas', 'Dilatação', 'Calor e mudanças de estado', 'Termodinâmica'),
      T('Óptica', 'Reflexão e espelhos', 'Refração e lentes'),
      T('Ondulatória', 'Ondas', 'Acústica'),
    ],
    em3: [
      T('Eletrostática', 'Carga elétrica', 'Campo e potencial elétrico'),
      T('Eletrodinâmica', 'Corrente elétrica', 'Leis de Ohm', 'Circuitos e resistores'),
      T('Eletromagnetismo', 'Campo magnético', 'Indução eletromagnética'),
      T('Física moderna', 'Relatividade', 'Física quântica (noções)'),
    ],
  },

  'Química': {
    em1: [
      T('Química geral', 'Matéria e estados físicos', 'Substâncias e misturas', 'Separação de misturas'),
      T('Estrutura atômica', 'Modelos atômicos', 'Tabela periódica'),
      T('Ligações químicas', 'Iônica, covalente e metálica', 'Geometria molecular e polaridade'),
      T('Funções inorgânicas e reações', 'Ácidos, bases, sais e óxidos', 'Balanceamento'),
    ],
    em2: [
      T('Estequiometria', 'Mol e massa molar', 'Cálculos estequiométricos'),
      T('Soluções', 'Concentração', 'Propriedades coligativas'),
      T('Físico-química', 'Termoquímica', 'Cinética química', 'Equilíbrio químico e pH', 'Eletroquímica'),
    ],
    em3: [
      T('Química orgânica', 'O carbono e as cadeias carbônicas', 'Funções orgânicas', 'Nomenclatura'),
      T('Isomeria e reações', 'Isomeria plana e espacial', 'Reações orgânicas'),
      T('Aplicações', 'Polímeros', 'Radioatividade'),
    ],
  },

  'História': {
    ef1: [
      T('O eu e o outro', 'Meu nome e minha história', 'Minha família'),
      T('Convivência', 'A escola e suas regras'),
      T('Noções de tempo', 'Antes, agora e depois', 'Brinquedos e brincadeiras de antigamente'),
    ],
    ef2: [
      T('A comunidade', 'Memórias e registros (fotos, documentos)', 'O trabalho na comunidade'),
      T('Noções de tempo', 'Dia, semana, mês e ano', 'Mudanças e permanências'),
    ],
    ef3: [
      T('O município', 'A história do lugar onde vivo', 'Povos que formaram a cidade'),
      T('Patrimônio', 'Espaços públicos e privados', 'Patrimônio histórico e cultural'),
      T('Trabalho', 'O trabalho no campo e na cidade'),
    ],
    ef4: [
      T('Transformações da humanidade', 'Do nomadismo à agricultura', 'Circulação de pessoas e produtos'),
      T('Migrações', 'Povos indígenas e africanos', 'Migrações para o Brasil'),
      T('Navegações', 'Rotas comerciais e navegações'),
    ],
    ef5: [
      T('Povos e culturas', 'Primeiras civilizações', 'Diversidade cultural'),
      T('Cidadania', 'Direitos e deveres'),
      T('Memória', 'Formas de registro (escrita, patrimônio)', 'Marcos da história do Brasil'),
    ],
    ef6: [
      T('Introdução à História', 'Tempo histórico e fontes'),
      T('Pré-História', 'Origem da humanidade'),
      T('Antiguidade', 'Mesopotâmia e Egito', 'Grécia e Roma', 'Povos antigos da África e da América'),
      T('Idade Média', 'Feudalismo'),
    ],
    ef7: [
      T('Mundo moderno', 'Renascimento e Reforma', 'Absolutismo e mercantilismo'),
      T('Grandes Navegações', 'Conquista da América'),
      T('Brasil colonial', 'Sociedade e economia açucareira', 'Escravidão e tráfico de africanos'),
    ],
    ef8: [
      T('Revoluções', 'Iluminismo', 'Revoluções Inglesa, Industrial e Francesa'),
      T('Independências', 'Independência dos EUA e da América Latina'),
      T('Brasil Império', 'Independência do Brasil', 'Primeiro Reinado e Regências', 'Segundo Reinado e abolição'),
      T('Imperialismo', 'Neocolonialismo no século XIX'),
    ],
    ef9: [
      T('Brasil República', 'Primeira República', 'Era Vargas', 'Ditadura militar', 'Redemocratização'),
      T('Século XX', 'Primeira e Segunda Guerra Mundial', 'Revolução Russa e crise de 1929', 'Totalitarismos'),
      T('Mundo contemporâneo', 'Guerra Fria', 'Descolonização', 'Globalização'),
    ],
    em1: [
      T('Antiguidade e Idade Média', 'Civilizações antigas (análise crítica)', 'Mundo medieval'),
      T('Formação do mundo moderno', 'Renascimento e Reformas', 'Expansão marítima'),
      T('América colonial', 'Colonização e resistência indígena e africana'),
    ],
    em2: [
      T('Revoluções e Estados nacionais', 'Iluminismo e revoluções burguesas', 'Revolução Industrial'),
      T('Brasil Império', 'Independência', 'Escravidão e abolição', 'Crise do Império'),
      T('Imperialismo', 'Partilha da África e da Ásia'),
    ],
    em3: [
      T('Brasil República', 'Primeira República', 'Era Vargas', 'Ditadura e redemocratização'),
      T('Conflitos do século XX', 'Guerras Mundiais', 'Guerra Fria'),
      T('Mundo contemporâneo', 'Conflitos contemporâneos', 'Globalização e direitos humanos'),
    ],
  },

  'Geografia': {
    ef1: [
      T('O sujeito e seu lugar', 'Minha casa e minha escola', 'Lugares de convivência'),
      T('Natureza', 'Dia e noite', 'Tempo: sol, chuva, frio e calor'),
      T('Localização', 'Perto e longe', 'Dentro e fora'),
    ],
    ef2: [
      T('A comunidade', 'Convivência e trabalho', 'Paisagens e mudanças'),
      T('Localização', 'Pontos de referência', 'Mapas simples (croquis)'),
      T('Natureza', 'Uso da água e do solo'),
    ],
    ef3: [
      T('Paisagem', 'Paisagem natural e modificada', 'Campo e cidade'),
      T('Produção e consumo', 'Da produção ao consumo'),
      T('Cartografia', 'Mapas, legendas e símbolos'),
      T('Meio ambiente', 'Impactos ambientais e preservação'),
    ],
    ef4: [
      T('Município e estado', 'Divisão político-administrativa', 'Relação campo-cidade'),
      T('Cartografia', 'Pontos cardeais', 'Escala', 'Imagens de satélite'),
      T('Trabalho', 'Trabalho e produção'),
    ],
    ef5: [
      T('População', 'Distribuição da população no Brasil', 'Migrações'),
      T('Cidades', 'Redes urbanas', 'Qualidade ambiental e saneamento'),
      T('Brasil', 'Regiões brasileiras', 'Mapas e escalas'),
    ],
    ef6: [
      T('Cartografia', 'Coordenadas geográficas', 'Fusos horários', 'Escala'),
      T('Planeta Terra', 'Estrutura da Terra', 'Relevo e hidrografia'),
      T('Clima e vegetação', 'Tipos de clima', 'Biomas'),
      T('Sociedade e natureza', 'Paisagem e identidade'),
    ],
    ef7: [
      T('Brasil', 'Formação territorial', 'Regiões e economia'),
      T('População brasileira', 'Diversidade e distribuição'),
      T('Natureza do Brasil', 'Biomas brasileiros e conservação'),
      T('Economia', 'Urbanização e industrialização', 'Agropecuária'),
    ],
    ef8: [
      T('América e África', 'Aspectos físicos', 'População e economia'),
      T('Geopolítica', 'ONU e blocos econômicos (Mercosul)', 'Migrações internacionais'),
      T('América Latina', 'Desigualdades e desenvolvimento'),
    ],
    ef9: [
      T('Europa, Ásia e Oceania', 'Aspectos físicos e humanos'),
      T('Globalização', 'Mundo multipolar', 'Fluxos de comércio e tecnologia'),
      T('Questões globais', 'Conflitos e diversidade cultural', 'Questões ambientais globais'),
    ],
    em1: [
      T('Cartografia e geotecnologias', 'Projeções', 'Sensoriamento remoto e GPS'),
      T('Geografia física', 'Geologia e relevo', 'Clima e hidrografia', 'Domínios morfoclimáticos'),
    ],
    em2: [
      T('População e urbanização', 'Dinâmica demográfica', 'Urbanização brasileira e mundial'),
      T('Geografia econômica', 'Agropecuária', 'Indústria', 'Energia'),
    ],
    em3: [
      T('Geopolítica mundial', 'Ordem mundial', 'Globalização', 'Conflitos contemporâneos'),
      T('Brasil no mundo', 'Regionalização do Brasil', 'Questões ambientais'),
    ],
  },

  'Língua Inglesa': {
    ef6: [
      T('First steps', 'Greetings and introductions', 'Verb to be', 'Numbers, colors and family'),
      T('Daily routine', 'Simple present', 'Days and time'),
    ],
    ef7: [
      T('Past events', 'Simple past', 'Past of verb to be'),
      T('Descriptions', 'There is / there are', 'Reading short texts'),
    ],
    ef8: [
      T('Future plans', 'Will and going to'),
      T('Comparisons', 'Comparatives and superlatives'),
      T('Modal verbs', 'Can, must and should'),
    ],
    ef9: [
      T('Experiences', 'Present perfect'),
      T('Hypotheses', 'Conditionals', 'Passive voice (introduction)'),
      T('English in the world', 'Reading opinion texts', 'English as a global language'),
    ],
    em: [
      T('Leitura e interpretação', 'Estratégias de leitura (ENEM)', 'Cognatos e falsos cognatos'),
      T('Gramática em contexto', 'Revisão dos tempos verbais', 'Conectivos'),
      T('Cultura', 'Gêneros textuais em inglês', 'Diversidade cultural'),
    ],
  },

  'Arte': {
    ef_iniciais: [
      T('Artes visuais', 'Desenho e pintura', 'Cores e formas'),
      T('Música', 'Sons e ritmos', 'Cantigas'),
      T('Dança e teatro', 'Movimento e expressão', 'Brincadeiras teatrais'),
      T('Cultura popular brasileira', 'Festas e manifestações'),
    ],
    ef_finais: [
      T('Linguagens artísticas', 'Artes visuais, música, dança e teatro'),
      T('História da arte', 'Grandes períodos e artistas'),
      T('Arte brasileira', 'Patrimônio cultural', 'Arte indígena e afro-brasileira'),
    ],
    em: [
      T('Movimentos artísticos', 'Do Renascimento ao Modernismo', 'Arte contemporânea'),
      T('Arte e sociedade', 'Arte, mídia e tecnologia'),
    ],
  },

  'Educação Física': {
    ef_iniciais: [
      T('Brincadeiras e jogos', 'Jogos populares', 'Brincadeiras de diferentes culturas'),
      T('Esportes', 'Noções de esportes coletivos'),
      T('Ginástica e danças', 'Movimentos do corpo', 'Danças populares'),
    ],
    ef_finais: [
      T('Esportes', 'Regras e fundamentos', 'Esportes de rede e de invasão'),
      T('Práticas corporais', 'Ginástica', 'Lutas', 'Práticas de aventura'),
      T('Saúde', 'Atividade física e bem-estar'),
    ],
    em: [
      T('Saúde e qualidade de vida', 'Atividade física e saúde', 'Alimentação'),
      T('Corpo e sociedade', 'Padrões de beleza', 'Esporte e mídia'),
    ],
  },

  'Ensino Religioso': {
    ef_iniciais: [
      T('Identidades e alteridades', 'Eu, o outro e o respeito'),
      T('Manifestações religiosas', 'Festas e símbolos'),
    ],
    ef_finais: [
      T('Crenças e filosofias de vida', 'Tradições religiosas'),
      T('Respeito à diversidade', 'Liberdade religiosa'),
    ],
  },

  'Filosofia': {
    em1: [
      T('Introdução à Filosofia', 'Mito e logos', 'Pré-socráticos'),
      T('Filosofia clássica', 'Sócrates', 'Platão', 'Aristóteles'),
    ],
    em2: [
      T('Teoria do conhecimento', 'Racionalismo e empirismo', 'Kant'),
      T('Ética', 'Ética e moral', 'Filosofia medieval e moderna'),
    ],
    em3: [
      T('Filosofia política', 'Contratualistas', 'Democracia'),
      T('Filosofia contemporânea', 'Existencialismo', 'Ciência e tecnologia'),
    ],
  },

  'Sociologia': {
    em1: [
      T('Introdução à Sociologia', 'Durkheim, Weber e Marx'),
      T('Cultura', 'Cultura e identidade', 'Etnocentrismo e diversidade'),
    ],
    em2: [
      T('Trabalho e sociedade', 'Mundo do trabalho'),
      T('Desigualdades', 'Estratificação social', 'Movimentos sociais'),
    ],
    em3: [
      T('Política e cidadania', 'Estado e democracia', 'Direitos humanos'),
      T('Sociedade contemporânea', 'Globalização', 'Mídia e redes sociais'),
    ],
  },
};

// ── Funções utilitárias ─────────────────────────────────────────────────────

export function getGrade(gradeId?: string): SchoolGrade | undefined {
  if (!gradeId) return undefined;
  return SCHOOL_GRADES.find((g) => g.id === gradeId);
}

export function getSubjectsForGrade(gradeId?: string): string[] {
  const grade = getGrade(gradeId);
  return grade ? STAGE_SUBJECTS[grade.stage] : [];
}

/** Temas e subtemas daquela matéria naquele ano (vazio para matérias livres / "Outra") */
export function getThemes(subjectName: string, gradeId?: string): CurriculumTheme[] {
  const grade = getGrade(gradeId);
  const map = CURRICULUM[subjectName];
  if (!grade || !map) return [];
  return map[grade.id] || map[grade.stage] || [];
}

/** Orientação pedagógica para a professora conforme a idade do aluno */
export function getAgeGuidance(age?: number): string {
  if (!age) {
    return 'Adapte a linguagem ao nível informado pelo aluno.';
  }
  if (age <= 7) {
    return [
      `Criança de cerca de ${age} anos, em fase de alfabetização. Provavelmente um adulto (pai, mãe ou responsável) está ao lado ajudando.`,
      '- Na saudação inicial, cumprimente também o responsável e peça que ele acompanhe a aula, ajude a ler o quadro e a segurar o caderno ou lápis.',
      '- Fale DEVAGAR, com frases MUITO curtas (até 8 palavras) e palavras do dia a dia. Nada de termos técnicos.',
      '- Use exemplos concretos e lúdicos: brinquedos, frutas, animais, dedos das mãos. Transforme o conteúdo em brincadeira.',
      '- No quadro: no máximo 3 elementos, palavras grandes e simples, letras de forma. Evite fórmulas.',
      '- Respostas de 10 a 15 segundos. Peça uma ação simples por vez ("conte comigo", "mostre com os dedos").',
      '- Elogie cada tentativa. Se a criança se cansar ou se dispersar, proponha uma pausa ou uma brincadeira rápida.',
    ].join('\n');
  }
  if (age <= 10) {
    return [
      `Criança de cerca de ${age} anos (anos iniciais do Fundamental). Um adulto pode estar acompanhando.`,
      '- Use frases curtas e linguagem simples; explique qualquer palavra nova com um exemplo.',
      '- Exemplos concretos do cotidiano infantil (escola, lanche, jogos, dinheiro do troco).',
      '- Explique passo a passo e confirme o entendimento com perguntas fáceis.',
      '- No quadro: poucos elementos, desenhos simples e números grandes.',
      '- Respostas de 15 a 20 segundos. Seja muito encorajadora.',
      '- Se perceber dificuldade grande, sugira com carinho que um adulto ajude.',
    ].join('\n');
  }
  if (age <= 14) {
    return [
      `Pré-adolescente/adolescente de cerca de ${age} anos (anos finais do Fundamental).`,
      '- Linguagem clara e próxima; introduza termos técnicos sempre explicando o significado.',
      '- Exemplos do universo dele(a): jogos, esportes, redes sociais, música.',
      '- Estimule a autonomia: peça que tente o próximo passo antes de você mostrar.',
      '- Respeite a autoestima: nunca ridicularize erros, trate-os como parte do aprendizado.',
    ].join('\n');
  }
  return [
    `Jovem de cerca de ${age} anos (Ensino Médio).`,
    '- Pode usar linguagem mais técnica e conceitos abstratos, sempre com clareza.',
    '- Faça conexões com ENEM, vestibulares e aplicações reais.',
    '- Estimule o raciocínio crítico e a resolução de questões no estilo de prova.',
  ].join('\n');
}
