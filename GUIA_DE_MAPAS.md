# Guia de mapas

Este projeto é uma semente: cada interior é um **mapa em arquivo** (`mapas/<id>.json`) montado sobre a imagem de uma planta vista de cima. Este guia serve para quem vai criar um mapa no editor, à mão ou com uma IA.

## Dois jeitos de criar

- **No editor:** abra `http://127.0.0.1:5173/editor.html` (ou o botão "Editor" na tela principal). Envie a imagem da planta, meça a escala com "Medir escala", desenhe paredes e portas, marque as salas ocultas, coloque móveis, luzes, câmeras, a chegada e as passagens. "Salvar" grava o arquivo em `mapas/` e "Ver em 3D" abre o resultado. Gravar exige o servidor local (`python3 servidor.py`); sem ele o editor baixa o arquivo para você colocar na pasta.
- **Escrevendo o arquivo**, à mão ou com uma IA: siga este guia. Um mapa escrito assim abre no editor para ajustes, e vice-versa.

**Antes de criar:** `README.md` diz que imagens preparar para cada tipo de lugar e traz os pedidos prontos para a IA de imagem. Para uma cidade inteira, peça em camadas: o chão limpo e uma folha de cada construção.

**Pedindo a uma IA:** coloque a imagem em `assets/interiores/` e peça o mapa. As instruções que ela segue estão em `AGENTS.md`. O resultado é uma primeira versão; a posição das portas e a escala são onde ela mais erra, e o editor serve para corrigir. Plantas desenhadas em perspectiva ela endireita antes; ilustrações (cenas vistas de dentro) ela **recusa** e explica por quê.

## Cidade em camadas (o melhor resultado)

Se a pessoa tem as imagens em camadas (veja o `README.md`), o mapa se monta assim.

1. **Chão.** O chão limpo é a `imagem`. `ceuAberto: true`, `corEntorno` com a cor da borda (`grade.py` imprime), `agua` com a cor medida do lago, `brilho` se a pintura for escura.
2. **Escala.** Meça pelas **janelas e portas das folhas** (porta 0,9 m de largura, andar 3 a 3,5 m) e confira com a largura das lajes no chão. A largura das ruas pintadas costuma enganar.
3. **Cada folha:** `python3 ferramentas/folha.py assets/predios/<nome>.png`. Ela acha as quatro vistas (em uma ou duas fileiras), diz qual é qual, tira a linha de chão, iguala as alturas e avisa quando as medidas não combinam. Copie o trecho impresso para `folhas`.
4. **Onde e de que tamanho.** Centro do prédio no centro da laje pintada para ele; `largura` = largura da laje em pixels × escala. A altura sai sozinha, da proporção da vista de frente.
   - **Folhas que não combinam** (a lateral pede uma profundidade e o telhado outra; `folha.py` avisa): dê `profundidade` pela laje.
   - **Prédio sem laje no chão limpo:** ponha-o onde a pintura de referência mostra, com a largura da frente tirada da escala, e diga na entrega que é chute.
   - **Não fixe `altura`**: achata a arte. Se o prédio ficar alto demais, a escala está errada.
5. **Folha modular** (capela, ruína): `folha.py --pecas --conferir rascunho/f.png`. As etiquetas de número saem sozinhas; a numeração é da ferramenta, não a pintada. Paredes com `profundidade` de 0,5 a 0,8 m em volta, torres sem profundidade, e o chão por dentro com `pisos` (as peças de lajota da folha viram `texturas`). **Não use a planta da folha como decalque**: o desenho dela fica aparecendo dentro.
6. **Chão especial** (pátio da subestação): `decalques`, e as peças 3D por cima nas posições pintadas.
7. **Casas pequenas:** itens de `predios` com `acabamento` e `telhadoAcabamento` do atlas. Cada uma é escrita no script; não se montam sozinhas.
8. **Mata e postes:** `python3 ferramentas/espalhar.py mapas/<id>.json arvores.json --mata --zona ...` e `--postes x y ...`. Ela evita prédios, água e a frente das câmeras.
9. **Fotos.** Vista de planta e uma de frente de cada prédio. O validador avisa de câmera dentro de prédio e de árvore na frente da câmera.

## Que imagem serve

- **Serve:** vista reta de cima, mostrando o piso e o topo das paredes.
- **Serve com adaptação:** piso reto, mas paredes que mostram a face além do topo (uma faixa com quadros, lousas, janelas). Veja "Paredes com a face aparente".
- **Serve como lugar a céu aberto:** vista aérea de um lugar inteiro (cidade, vila, base, porto), com as ruas retas e os prédios desenhados em pé, vistos de fora. Os prédios viram volumes fechados. Veja "Lugar inteiro visto do alto".
- **Serve depois de endireitada:** planta em perspectiva. O contorno do prédio vira um trapézio, os móveis encolhem para o fundo e mostram a lateral, as fileiras convergem. Veja "Planta em perspectiva".

O que decide entre esses dois casos é o piso: se os móveis têm o mesmo tamanho no alto e no pé da imagem e as fileiras são paralelas, a planta serve, mesmo com portas pintadas em pé na face das paredes.

- **Não serve:** ilustração, isto é, uma cena vista de dentro ou de fora, com teto ou céu e ponto de fuga.
- **Serve depois de limpa:** pintura com a quadrícula de mapa de batalha. Tire a grade com `quadricula.py` antes de ler as posições (veja "Ferramentas").

Como a imagem vira o piso, numa ilustração as paredes, janelas e móveis ficariam pintados deitados no chão. É preciso outra imagem: uma planta vista do alto.

Versão de noite: precisa ter o mesmo enquadramento da de dia, isto é, as paredes e os móveis no mesmo lugar do desenho. O tamanho em pixels pode ser outro, desde que a proporção seja a mesma (o programa estica a de noite sobre o mesmo piso). Detalhes a mais (luzes, vultos, manchas) não atrapalham. `ferramentas/comparar.py` mostra as duas em faixas alternadas para conferir. Se não baterem, use só a de dia.

## Planta em perspectiva

Muita planta de RPG é desenhada inclinada, como uma casa de bonecas vista de frente e do alto: o fundo fica mais estreito que a frente e a parede do fundo aparece em pé. `endireitar.py` corrige isso.

- **Cantos.** Você informa quatro pontos do piso que formam um retângulo de verdade (em geral os cantos do prédio, no pé das paredes), nesta ordem: fundo à esquerda, fundo à direita, frente à direita, frente à esquerda. Se o pé da parede não aparece: na frente, use a borda de dentro do topo da parede; nas laterais, meça a borda entre a face e o piso em dois pontos e prolongue; em piso de ladrilho, quatro cruzamentos de ladrilhos também servem.
- **O que a ferramenta faz.** Estica a imagem até esse quadrilátero virar um retângulo. O piso fica exato: laterais na vertical e a mesma escala no fundo e na frente. A imagem inteira é mantida, com dois cantos pretos; `--recortar` tira os cantos pretos e perde uma fatia das bordas.
- **Profundidade.** A vista inclinada achata o chão. Meça na saída algo redondo ou quadrado (mesa redonda, ladrilho, tapete); se a largura e a altura forem diferentes, rode de novo com `--esticar`. Até 5% de diferença é aceitável.
- **Conferência.** `--conferir arquivo.png` grava a imagem original com os cantos desenhados.
- **Noite.** Compare as duas originais com `comparar.py` antes. Se batem, use os mesmos números na de noite. Se não batem, meça os cantos da noite à parte e acrescente o `--encaixar` que a execução da de dia imprime; ele põe o retângulo no mesmo lugar.
- **Nomes.** A original vira `<id>_perspectiva_dia.png`; a endireitada fica como `<id>_dia.png`.

O resultado é uma planta com paredes de face aparente (veja adiante), e o mapa é feito sobre ela. Nela, o que tem altura aparece esticado para o fundo:

- Meça a escala só no que está no chão (ladrilho, tapete, largura de uma porta no pé dela).
- A base de verdade de um móvel alto é a parte de baixo da pintura. Volumes (armário, máquina) cobrem a pintura inteira; painéis finos (mural, cavalete, biombo) ficam no pé dela.

O que não tem conserto: o que está pintado nas paredes some sob a parede 3D; móveis pequenos que ficam como pintura continuam mostrando a lateral; o fundo da imagem perde um pouco de nitidez por ter sido ampliado.

## Como um mapa funciona

- A **imagem da planta** vira o piso.
- Por cima dela entram **paredes, portas, móveis e luzes em 3D**, nas posições que você informar.
- Todas as posições são em **pixels da imagem** (`x` para a direita, `y` para baixo, origem no canto superior esquerdo).
- `escala` diz quantos **metros vale um pixel**. Tamanhos e alturas são em **metros reais**. O programa amplia os interiores na tela (hoje 2,2 vezes, para a câmera caber nos cômodos), mas isso não muda o que se escreve.
- **Só se anda até 2 m além da borda da imagem**, e o ponto para onde a câmera olha também fica preso aí. Peças fora disso aparecem, mas ninguém chega perto delas; o validador avisa de chegada, câmera ou passagem fora dessa área. Para um lugar maior (perseguição, mata em volta, estrada que continua), aumente a imagem, não a `escala` (com a escala, tudo cresce junto): `ampliar.py` põe chão em volta da pintura, e `compor.py` espalha pedaços dela num chão grande, ligados por trilhas.

## Passo a passo

1. Coloque a imagem em `assets/interiores/` (`<id>_dia.png` e, se houver, `<id>_noite.png`; com uma versão só, o nome pode ficar como veio).
2. Descubra o tamanho da imagem em pixels (`larguraPx`, `alturaPx`).
3. Calcule a `escala`: meça em pixels algo de tamanho conhecido e divida. Cadeira ≈ 0,45 m, carteira ≈ 0,6 m, porta ≈ 0,9 m, cama de solteiro ≈ 2 m. Exemplo: porta com 50 px → `0.9 / 50 = 0.018`. Se objetos derem escalas diferentes, móveis e portas valem mais que quadras, ruas e o tamanho do prédio; se móvel e porta discordarem, fique entre os dois, com os vãos das portas em 0,8 m ou mais.
4. Leia as posições com a grade e escreva `mapas/<id>.json`. O `id` segue `<local>_<parte>` (`escola_terreo`, `predio_andar2`, `igreja_interior`).
5. Acrescente o nome do arquivo em `mapas/indice_local.json`, a lista dos seus mapas (o editor faz isso ao salvar). `mapas/indice.json` é a dos exemplos que vêm com o programa.
6. Valide, olhe a prévia e tire fotos em 3D; repita até ficar certo e bonito.

## Ferramentas

Só precisam do Python padrão (no Windows, `py` no lugar de `python3`; com numpy e Pillow instalados, ficam mais rápidas). Leem qualquer PNG, mas só PNG de verdade: algumas imagens têm extensão `.png` e são WebP ou JPEG (a ferramenta avisa); converta antes com `ffmpeg -i entrada saida.png` ou, no Mac, `sips -s format png entrada --out saida.png`. As imagens de conferência vão bem em `rascunho/`, que fica fora do git.

```
python3 ferramentas/grade.py assets/interiores/planta.png rascunho/g.png --passo 100
python3 ferramentas/grade.py assets/interiores/planta.png rascunho/g.png --recorte 0 0 500 400 --recorte 500 0 500 400 --zoom 2 --passo 50
python3 ferramentas/validar.py mapas/meu_mapa.json
python3 ferramentas/validar.py --tudo
python3 ferramentas/previa.py mapas/meu_mapa.json rascunho/p.png --contorno --sem-rotulos
python3 ferramentas/comparar.py planta_dia.png planta_noite.png rascunho/c.png --clarear 2.5
python3 ferramentas/endireitar.py planta_perspectiva.png planta.png --cantos 243 160 1457 160 1530 718 150 718 --esticar 1.15
python3 ferramentas/foto.py mapas/meu_mapa.json rascunho/f.png --camera 0 --de 700 900 --para 700 400
python3 ferramentas/apagar.py planta.png planta_limpa.png --area 620 340 665 540 --de 60 0
python3 ferramentas/folha.py assets/predios/hotel.png --alinhar rascunho/alinhar.png
python3 ferramentas/compor.py chao_novo.png --tamanho 4000 3200 --fundo pintura.png 700 660 1000 705 --peca pintura.png 250 110 1180 670 --em 1500 1050 --k 0.8 --trilha 500 1500 900 1100 1100 1000
```

- **`grade.py`** desenha uma grade numerada; os números são pixels da imagem original, mesmo com recorte e zoom (`--zoom` é inteiro). Aceita vários `--recorte` de uma vez (grava `g_1.png`, `g_2.png`...) e `--clarear 2.5` para plantas escuras.
- **`validar.py`** aponta erros e avisos: campo faltando, imagens de tamanhos diferentes ou que não existem (`imagemPlanta`, textura de porta), paredes sobrepostas, sala oculta sem porta, porta estreita ou que não encosta em parede, móvel de tipo desconhecido, chegada dentro de sala oculta, luz dentro de parede, passagem para mapa que não existe, chegada, câmera ou passagem a mais de 2 m fora da imagem, valores fora do lugar (`hora`, `luar`, `lua`, `vao` de folha, `alturaFolha`), desafios sem peça ou só com peças de "antes", e nomes em `criaturas` que a campanha não tem. `--tudo` confere todos os mapas de uma vez e as próprias listas: arquivo listado que não existe, o mesmo mapa nas duas listas, dois mapas com o mesmo `id` e mapa na pasta que nenhuma lista tem (ele não aparece no programa).
- **`comparar.py`** grava as duas imagens em faixas verticais alternadas; se as linhas das paredes quebram nas emendas, as imagens estão deslocadas.
- **`endireitar.py`** transforma uma planta em perspectiva numa planta reta, a partir de quatro cantos do piso. Opções: `--esticar`, `--conferir`, `--recortar`, `--encaixar`.
- **`foto.py`** tira uma foto do mapa em 3D, sem abrir janela (precisa do Google Chrome instalado). `--camera n` usa uma câmera do mapa (0 é a de planta); `--de X Y --para X Y --altura M` olha de um ponto a outro da planta; `--noite`, `--dia`, `--revelar`. Dá para pedir várias vistas numa chamada. `--porta 5174` se a 5173 estiver ocupada por outro programa; `--espera 600` num mapa enorme (milhares de árvores), que sem janela passa de 3 minutos. **É a conferência que vale:** a prévia mostra se as peças estão no lugar; a foto mostra se o mapa ficou bom.
- **`apagar.py`** corrige a pintura. Apaga o que atrapalha (a vela pintada no convés, a sombra de um mastro) copiando por cima um pedaço vizinho do piso (`--area` com `--de`), ou cobrindo com as cores da beira quando não há vizinho igual (`--preencher`). **Remendo com "print":** `--ladrilhar X0 Y0 X1 Y1 --amostra SX0 SY0 SX1 SY1` cobre uma área repetindo um pedaço limpo da própria pintura (rua, estacionamento, gramado), para continuar o piso onde ficou um buraco; `--colar SX0 SY0 SX1 SY1 --em X Y` copia um pedaço (uma casa, uma faixa de pedestre) para outro lugar.
- **`folha.py`** lê a folha de referência de um prédio (quatro vistas sobre fundo liso) e imprime onde está cada vista, pronto para o campo `folhas`. Com `--pecas`, lista as peças soltas de uma folha modular. Folha em **pergaminho** (moldura, manchas, rótulos): `--limpar limpa.png --manter <retângulo de cada vista> --papel` tira o papel e deixa transparentes os vãos presos no desenho (entre as pernas de uma torre, sob uma mesa), que de outro jeito virariam placas opacas. `--espelhar X0 Y0 X1 Y1` desvira uma vista que veio espelhada (na lateral direita, a frente do prédio fica do lado esquerdo da vista). Se a quarta vista tem o tamanho de uma lateral, a folha trouxe as duas laterais e nenhum telhado: use só frente, lado e fundos. **`--alinhar rascunho/a.png`** é a conferência da folha: põe o telhado girado em cima de cada vista, na mesma escala e com linhas-guia, e mostra a "volta" no prédio (frente, lateral e fundos lado a lado). Chaminés, torres e cúpulas têm que cair na mesma linha no telhado e na vista; se só caem na lateral desvirada, ela veio espelhada. Nenhuma ferramenta decide isso sozinha: olhe.
- **`quadricula.py`** tira a grade de um mapa de batalha (linhas finas, mesmo irregulares). `--marcar` mostra em rosa o que sai; `--agua` faz uma segunda passada mais fina na água, onde a grade é clara; `--maximo 150` tira também uma grade escura, bem marcada (o padrão só tira as suaves, para não apagar traços do desenho). A rosa dos ventos e a moldura não saem: `apagar.py --ladrilhar` e corte.
- **`ampliar.py`** põe a pintura no meio de um chão maior, coberto com um pedaço do próprio chão (`--amostra`), escurecendo para mata longe dela (`--escurecer 0.65`). Só se anda até 2 m além da borda da imagem: é assim que um mapa fica maior que a pintura sem mudar a escala.
- **`compor.py`** espalha as partes de uma pintura num chão grande: cada `--peca` é um retângulo da pintura posto onde `--em` manda (o mesmo `--k` em todas; `--forma elipse` para lago e ilha), com a beira irregular, e cada `--trilha` é um caminho de terra em curva passando pelos pontos dados (uma trilha sem saída é só uma trilha que acaba no mato). No fim imprime, pedaço por pedaço, a conta que leva uma posição lida na pintura para o chão novo. A escala do mapa passa a ser a da pintura dividida por `--k`. As amostras de chão (`--fundo`) e de terra (`--terra`) têm de ser limpas: o que houver nelas se repete pelo chão inteiro.
- **`figuras.py`** e **`objeto.py`** não são para mapas: recortam personagens e montam objetos 3D para a campanha (veja a seção 6 do `README.md`).
- **`espalhar.py`** espalha mata onde o chão é verde (`--mata --zona ...`) e leva postes para a calçada mais próxima (`--postes x y ...`), sem pôr nada em prédios, água ou na frente das câmeras.
- **`relevo.py`** ergue em blocos o que tem certa cor: as sebes de um labirinto, muretas, canteiros. Grava uma lista para juntar em `predios`; `--mascara` mostra antes o que vai subir. `--predios mapas/<id>.json` tira do chão a pintura de todos os prédios com fachada. Grave com outro nome e aponte `imagem` para o arquivo novo.
- **`previa.py`** desenha o mapa por cima da planta (plataformas em verde-água, prédios em dourado). `--passo 50` põe por cima a mesma grade numerada do `grade.py`, para ler de quantos pixels uma peça está fora. `--contorno` mostra a área que cada parede ocupa de verdade, com a planta visível por baixo; `--sem-rotulos` tira os nomes de salas, móveis e portas; `--recorte` (vários de uma vez), `--zoom` e `--clarear` funcionam como na grade.

## Formato do arquivo

```json
{
  "id": "meu_mapa",
  "nome": "Nome que aparece na tela",
  "local": "taverna",
  "imagem": "assets/interiores/meu_mapa_dia.png",
  "imagemNoite": "assets/interiores/meu_mapa_noite.png",
  "larguraPx": 1672,
  "alturaPx": 941,
  "escala": 0.018,

  "ceuAberto": true,
  "hora": "dia",
  "corEntorno": "#0d4a86",

  "acabamento": "papelDeParede",
  "corParede": "#ffffff",
  "espParede": 0.22,
  "alturaParede": 2.5,
  "teto": { "cor": "#2b1f16", "vigas": true, "area": [86, 44, 1614, 904] },
  "moldura": [86, 44, 1614, 904],

  "paredes": [[95, 53, 1565, 53], { "p": [484, 597, 484, 326], "esp": 0.3, "altura": 1.2 }, { "faixa": [95, 300, 620, 380] }],
  "plataformas": [{ "pontos": [[450, 385], [850, 326], [1192, 437], [850, 553], [450, 498]], "altura": 2.6, "cor": "#4a2f1c", "afunila": 0.85, "mureta": 1 }],
  "grades": [[465, 352, 622, 352]],
  "barreiras": [[590, 498, 1083, 498]],

  "salas": { "cozinha": [[95, 404, 484, 757]] },
  "portas": [{ "p": [484, 597, 484, 670], "revela": ["cozinha"], "sentido": -1 }],

  "moveis": [{ "tipo": "mesa", "x": 310, "y": 655, "giro": 0, "w": 1.6, "d": 0.8, "cor": "#5a3a22" }],
  "luzPadrao": { "cor": "#ffc078", "forca": 0.13, "raio": 4.5, "altura": 2 },
  "luzes": [{ "x": 260, "y": 62 }, { "x": 310, "y": 600, "cor": "#ff7a28", "forca": 0.2 }],

  "cameras": [{ "nome": "Cozinha", "de": [440, 722], "para": [250, 590], "altura": 1.9 }],
  "chegada": { "de": [835, 850], "para": [820, 400] },
  "passagens": [{ "x": 835, "y": 880, "altura": 1.3, "nome": "Porta da frente", "anim": "porta", "destino": { "local": "taverna", "camera": 1 } }]
}
```

Obrigatórios: `id`, `imagem`, `larguraPx`, `alturaPx`, `escala`. O resto é opcional.

| Campo | O que é |
|---|---|
| `local` | Só com uma campanha que tenha cidade (veja "Sua campanha" no `README.md`): o local da cidade a que o mapa pertence (aparece como "Entrar: <nome>" lá; vários mapas podem ter o mesmo local, como os andares de um prédio). Sem ele, o mapa entra na lista "Mapas" da tela; é o caso comum. |
| `ceuAberto` | `true` para lugares ao ar livre (navio, cidade, base, praia): o mapa ganha céu e sol, a tecla N alterna dia e noite, e as `luzes` só acendem à noite. Sem ele, o mapa é um interior escuro iluminado pelas `luzes`. |
| `hora` | `"dia"`, `"entardecer"` (sol baixo e alaranjado, janelas e lanternas acesas) ou `"noite"`: como o mapa abre. Só vale com `ceuAberto`. |
| `luar` | Quanto a noite clareia, de 0 a 1 (padrão 1). `0.2` faz uma noite bem escura: luar, céu, névoa e o brilho da pintura e das fachadas caem juntos; o que ilumina são as `luzes` e a lanterna. Só vale com `ceuAberto`. |
| `lua` | Onde a lua fica no céu: `{ "azimute": 5, "altura": 15 }`, em graus (azimute a partir do norte, que é o alto da planta, no sentido horário). O luar vem de lá. Para ela aparecer nas câmeras, que olham quase na horizontal, use altura de 10 a 20 e o azimute para onde as câmeras principais olham. Sem o campo, ela fica alta, a sudeste. |
| `agua` | `true` põe água em movimento (ondas e brilho) por cima de tudo o que é azul ou verde-água na pintura. Se pegar o que não é água (sombras azuladas, gelo) ou não pegar um lago escuro, dê a cor medida na imagem: `{ "cor": "#162428", "tolerancia": 0.3, "forca": 0.25 }`. A comparação é pelo tom, então asfalto escuro não entra como lago escuro. `forca` é o brilho das ondas (de perto, 0,2 a 0,3 basta). |
| `clima` | `"neve"` ou `"petalas"`: partículas caindo sobre o mapa. |
| `predios` | Prédios vistos de fora: com chão limpo, casas com textura do atlas; com pintura, volumes que conservam a pintura no telhado. |
| `folhas` | Prédios montados com uma folha de vistas. Veja "O melhor material de entrada". |
| `decalques` | Pedaço de chão vindo de outra imagem, deitado sobre o piso. |
| `pisos` | Piso com textura por cima da pintura, num contorno: `{ "area": [x0, y0, x1, y1], "acabamento": "pisoCapela", "alt": 0.03 }` (ou `"pontos"`). |
| `texturas` | Quadros de um atlas (ou de uma folha) que viram acabamentos com nome. |
| `corTopo` | Cor da tampa das paredes. A céu aberto o padrão é a cor da parede; em interiores, preto. |
| `imagemPredios` | A planta original, quando `imagem` é a versão com os prédios apagados do chão. Mesmo tamanho de `imagem`. |
| `brilho` | Clareia a pintura quando ela é escura demais para o 3D (1 = como está; 2 = o dobro). Vale para o piso, os telhados e as fachadas. |
| `corEntorno` | Cor do chão em volta da imagem, para o mapa não acabar no vazio (azul do mar, branco da neve, verde do mato). |
| `acabamento` | Parede: `papelDeParede` (papel de parede e lambri), `tabuas`, `madeira`, `concreto`, `pedra`, `ruina` (pedra velha com musgo, escorridos e rachaduras), `tijolo`, `metal` (chapas rebitadas), `reboco` (branco com esteios de madeira), `gelo`; e as **texturas fotográficas dos pacotes**: `pedraMuro`, `arenito`, `paralelepipedo`, `pisoPraca`, `calcada`, `asfalto`, `grama`, `telhaBarro`, `ardosiaFoto`, `rebocoBranco`, `concretoParede`. Um nome de `texturas` do mapa também vale. Sem ele, parede lisa na cor `corParede`. Com ele, `corParede` tinge a textura. |
| `alturaParede` | Altura das paredes em metros, quando forem mais baixas que o pé-direito. O pé-direito padrão é 4,1 m, alto de propósito para a câmera caber nos cômodos; muros de quintal: 2,5. Cada parede pode ter a sua com `altura`. |
| `teto` | Aparece só com a câmera abaixo dele. `vigas` põe vigas de madeira. `area` é o retângulo `[x0, y0, x1, y1]` que ele cobre (o prédio); sem `area`, cobre a planta inteira. Lugar a céu aberto: não use. |
| `moldura` | Retângulo `[x0, y0, x1, y1]` em volta do prédio; pinta de preto o que fica fora. Não use se a área de fora (rua, calçada) deve aparecer. |
| `paredes` | Segmentos `[x1, y1, x2, y2]` pela linha do meio da parede, ou `{ "p": [...], "esp", "altura", "cor", "acabamento" }`. Parede grossa: `{ "faixa": [x0, y0, x1, y1] }`, o retângulo que ela ocupa, com as mesmas opções. Parede curva ou em vários trechos: `{ "pontos": [[x, y], [x, y], ...], "esp", "altura" }`, uma linha quebrada (`"fechada": true` liga o último ponto ao primeiro). O editor grava as duas de volta como linhas com espessura. |
| `plataformas` | Pisos elevados: convés de navio, cais, palco, mezanino. Veja "Pisos elevados e navios". |
| `grades` | Barras de ferro de um ponto a outro; dá para ver através, mas não passar nem abrir. |
| `barreiras` | Colisão invisível (parapeitos, bordas, topo de escada que não leva a lugar nenhum). |
| `salas` | Cômodos que começam ocultos: nome → lista de retângulos `[x0, y0, x1, y1]` que os cobrem, até a linha do meio das paredes (com parede grossa o retângulo entra na faixa, e está certo). |
| `portas` | `p` são as duas pontas do vão; a dobradiça fica na primeira. `revela` lista as salas que aparecem ao abrir. `sentido`: andando do primeiro ponto para o segundo, `1` abre para a esquerda e `-1` para a direita; a porta `[100, 200, 150, 200]` com `sentido: 1` abre para cima na imagem (y menor). `fixa: true` faz uma porta que não abre. `textura` troca a folha lisa por um painel com arte: `{ "imagem": "assets/predios/portao.png", "rect": [x0, y0, x1, y1], "espelhar": true }`, o retângulo da arte dentro da imagem (a parte transparente fica vazada, como num portão de ferro); `alturaFolha` é a altura desse painel em metros. Para um portão de duas folhas, duas portas, cada uma com a dobradiça na ponta de fora e `espelhar` numa delas. |
| `moveis` | Peças do kit. `giro` em graus: 0 = frente para baixo na planta, 90 = para a direita, 180 = para cima, -90 = para a esquerda; qualquer ângulo vale. |
| `luzes` | Pontos de luz. `forca` típica de 0,1 a 0,2; `raio` é o tamanho da mancha no chão; `altura` em metros. `luzPadrao` dá os valores comuns. |
| `cameras` | Câmeras de cena: de onde (`de`) e para onde (`para`) olham; `altura` em metros (padrão 1,9); `alturaAlvo` é a altura do ponto olhado (padrão 1,2; aumente para enquadrar um prédio alto de perto). A vista "Planta" é criada sozinha. |
| `chegada` | Onde a câmera aparece, a pé, ao entrar: posição `de`, olhando para `para`. |
| `criaturas` | Quais personagens e criaturas da campanha aparecem no painel enquanto este mapa está aberto: `["explorador", "lobo"]` (os `id` deles). Sem o campo, aparecem todos. |
| `imagemPlanta` | Um mapa desenhado para os jogadores (sem segredos, com cara de mapa de papel), mostrado no lugar da cena quando o mestre escolhe o ângulo "Planta" deste mapa, também na segunda tela: `"assets/interiores/<id>_mapa_jogadores.png"`. Qualquer tamanho; aparece inteiro e centralizado. |
| `desafios` | A ordem e o verbo dos desafios do mapa (o que os jogadores montam ou acendem): `[{ "nome": "Cabana 1" }, { "nome": "Fogueira", "acao": "acender" }]`. `acao` padrão: `montar`. Veja "Desafios: antes e depois". |
| `passagens` | Pontos clicáveis que levam a outro lugar. `altura` é a do marcador. `anim`: `porta` (porta de metal), `porta-dupla`, `porta-madeira` (porta de tábuas de cabana ou chalé), `som` ou `corte`; as três primeiras tocam a animação de abrir a porta no escuro. `destino`: `{ "mapa": "<id>" }` leva a outro mapa e chega na `chegada` dele; com `"camera": n` chega na câmera `n` daquele mapa (0 = planta, 1 = a primeira de `cameras`, e assim por diante). `{ "local": "<local>", "camera": n }` leva à cidade, na câmera `n` daquele local (0 = vista aérea, 1 = vista da entrada). |

## Paredes

- **Linha do meio.** A parede 3D ocupa meia espessura para cada lado da linha. Ela também **passa meia espessura além de cada ponta**, para fechar os cantos. Com a espessura padrão (0,22 m) isso não se nota; para paredes grossas, use `faixa` (veja "Paredes com a face aparente"), que já desconta essa medida. `previa.py --contorno` mostra a área exata.
- **Canto:** as duas paredes terminam no mesmo ponto. Com paredes grossas, use `faixa` e deixe os retângulos se encostarem.
- **Junção em T:** a parede que chega termina na linha do meio da parede que passa. A que passa continua inteira; não a parta.
- **Mesma linha:** duas paredes na mesma linha não podem se sobrepor. Onde uma termina, a outra começa, ou há um vão.
- **Vão de porta:** interrompa a parede e ponha a porta entre as duas pontas. Vão de 0,8 m ou mais, para criaturas e câmera passarem. As pontas da porta são as bordas do vão livre; em parede grossa, as pontas escritas das paredes ficam recuadas meia espessura em relação a elas.

### Paredes com a face aparente

Em muitas plantas a parede aparece como uma faixa larga: o topo (uma tira estreita) mais a face (com quadros, lousas, janelas). Se você pusesse uma parede fina só no topo, a face ficaria pintada no chão ao lado dela.

Cubra a faixa inteira, descrevendo a parede pelo retângulo que a faixa ocupa: `{ "faixa": [x0, y0, x1, y1] }`. O programa calcula a linha do meio e a espessura, e a peça ocupa exatamente esse retângulo. Vale para todas as paredes que mostram a face, por dentro ou por fora. Num canto, os retângulos das duas paredes se encostam ou se sobrepõem.

- **Portas nessas paredes:** a porta aparece pintada em pé na face. Deixe um vão entre duas faixas e ponha a linha da porta no meio da altura da faixa, com as pontas nas bordas esquerda e direita da porta pintada. Em faixa muito grossa a porta fica no fundo de um nicho; é o esperado.
- **Porta para um cômodo que não está na planta:** `"fixa": true`.
- **Móvel encostado na parede:** ele está pintado sobre a face. Ponha a peça 3D no pé da faixa, logo abaixo do desenho, não dentro da parede.
- **O que está pintado na face some** sob a parede 3D. Lousas e quadros voltam como uma `caixa` fina erguida com `alt`, encostada na frente da parede. Se for algo que precisa aparecer como pintura (um letreiro), deixe aquele trecho com parede fina no topo e avise.
- **Parede que o desenho não mostra** (a da frente, cortada para se ver o interior): ponha uma parede fina na borda do piso e diga que é chute.
- **Paredes inclinadas** não cabem em `faixa`; use a linha do meio com `esp`, encurtando as pontas meia espessura.

## Salas ocultas e portas

- Uma sala em `salas` começa preta e só aparece quando uma porta que a `revela` é aberta. Sem porta, fica preta para sempre.
- **Na dúvida sobre onde é a porta, não crie a sala oculta nem a porta: deixe só o vão na parede.** O cômodo fica visível e acessível.
- A `chegada` não pode ficar dentro de uma sala oculta.

## Lugares a céu aberto

Pátios, quintais, quadras, ruas:

- Sem `teto`. `moldura` só se o que está fora não deve aparecer.
- Muros com `alturaParede` (ou `altura` em cada parede) em torno de 2,5 m; muretas, 1 m.
- Cercas e alambrados com `grades`, **sempre deixando uma abertura**.
- Árvores: um `cilindro` verde alto, ou tronco fino mais copa erguida com `alt`.
- Luzes espalhadas pelo espaço, não "uma por cômodo".

## Céu aberto

Um navio no mar, uma cidade, uma base, uma praia: use `"ceuAberto": true`.

- O mapa ganha céu e sol. `"hora": "dia"` ou `"noite"` escolhe como ele abre; a tecla N alterna.
- As `luzes` só acendem à noite. Ponha-as onde há lampiões, tochas ou janelas acesas na pintura, junto com um `poste` quando fizer sentido.
- `corEntorno` pinta o chão em volta da imagem com a cor que domina a borda dela (mar, neve, mato).
- Sem `teto` e sem `moldura`.
- À noite há luar: o mapa continua visível, e as `luzes` acrescentam manchas quentes. Se a pintura é de entardecer, abra de dia.
- **Escala:** nesses mapas um pixel vale muito mais (de 0,03 a 0,15 m). Meça por algo de tamanho conhecido, nesta ordem de confiança:
  1. veículos e peças grandes: jipe 3,8 m, caminhão 6,2 m, contêiner 6 m de comprimento (2,4 m de ponta), canhão 1,7 m, bote a remo 3,5 a 4 m, barraca de feira 3 m;
  2. a quadrícula de 1,5 m que muitos mapas de RPG trazem (meça várias casas e use a mediana; em imagem gerada ela costuma ser irregular);
  3. construções: fachada de casa pequena 5 a 7 m, rua principal 6 a 8 m;
  4. portas, por último: com 10 a 20 px, um pixel de erro muda muito.
- **Vista oblíqua:** meça um círculo pintado no chão (heliponto, emblema de praça). Se a altura for menor que 0,85 da largura, o chão está achatado. Estique a imagem antes de medir o resto: `python3 ferramentas/endireitar.py imagem.png saida.png --cantos 0 0 L 0 L A 0 A --esticar largura/altura`, com `L` e `A` a largura e a altura da imagem.
- **`corEntorno`:** `grade.py`, rodado na imagem inteira, imprime a cor mediana da borda.

## Pisos elevados e navios

`plataformas` ergue um pedaço do piso. O contorno sobe até `altura` (em metros) e leva junto a pintura que está dentro dele; as laterais ganham a cor `cor`.

```json
"plataformas": [
  { "pontos": [[450, 385], [520, 347], [850, 326], [1110, 378], [1192, 437], [1110, 500], [850, 553], [520, 532], [450, 498]],
    "altura": 2.6, "cor": "#4a2f1c", "afunila": 0.85, "mureta": 1, "espMureta": 0.3 },
  { "area": [450, 347, 522, 532], "altura": 3.8, "cor": "#4a2f1c" }
]
```

| Opção | O que é |
|---|---|
| `pontos` ou `area` | O contorno: uma lista de pontos `[x, y]` em volta da peça (qualquer forma), ou o retângulo `[x0, y0, x1, y1]`. |
| `altura` | Altura do piso, em metros, contada do chão. |
| `cor` | Cor das laterais. |
| `afunila` | Menor que 1 fecha a base em direção ao centro, como um casco (0,85 é um bom valor). O chão embaixo é coberto com a cor `fundo` (padrão: azul escuro de mar). |
| `fundo` | Cor, em hexadecimal, que cobre o chão embaixo de um casco afunilado. Padrão `#0c3558`. |
| `balanco` | `true` faz a plataforma e tudo o que está em cima dela balançar como um navio na água (só uma por mapa; ponha no casco). |
| `mureta` | Altura, em metros, de uma amurada em toda a borda, centrada na linha do contorno. `espMureta` e `corMureta` mudam a espessura e a cor. |
| `encosta` | `true`, com `afunila` maior que 1: a lateral vira uma encosta com a pintura do chão por cima (em vez da cor lisa), e anda-se por ela. É assim que se faz um morro (veja abaixo). |

**Tudo o que está dentro do contorno sobe sozinho:** móveis, paredes, luzes, câmeras, a chegada e as passagens ficam em cima da plataforma sem você informar altura nenhuma. Vale o ponto `x`, `y` da peça (numa parede, o ponto do meio); por isso ponha as paredes da borda uns 3 px para dentro do contorno. Uma peça que passa da borda (verga, canhão) continua inteira na altura da plataforma. Uma plataforma dentro de outra vale pela mais alta (o castelo de popa sobre o convés). Criaturas não sobem um desnível maior que 0,3 m: para ligar dois níveis, faça degraus com `caixa`; o validador avisa quando faltam.

**Um navio visto de cima:**

1. **Casco:** contorne a borda de fora do casco com 15 a 40 pontos (mais pontos nas curvas da proa e da popa) e faça dele uma plataforma com `altura` de 2 a 3 m, `afunila` 0,85, `mureta` 1 e `balanco: true`. No mapa, `"agua": true`.
2. **Níveis:** castelo de popa e de proa são plataformas menores, dentro do casco, 1 a 1,5 m mais altas. Os indícios, vistos de cima, são uma faixa atravessada no convés, degraus pintados ou uma sombra na borda. Sem indício, deixe tudo num nível só e avise. Ponha degraus de `caixa` no convés, encostados nelas, e uma mureta de `paredes` com `pontos` na borda que dá para o mar.
3. **Mastros:** um `mastro` em cada um, com `x`, `y` no pé do mastro (o círculo pintado no convés, não a verga), `giro` apontando para a proa (é para lá que o pano enfuna) e `w` igual ao comprimento da verga pintada. As velas e sombras pintadas continuam no piso, embaixo das de verdade: apague-as da imagem com `apagar.py`, copiando o tabuado vizinho.
4. **Peças:** `canhao` apontando para fora do bordo, `timao`, `gurupes` na proa, `barril`, `caixote`, `poste` nos lampiões, `cilindro` para o cabrestante. Se algo está pintado fora do casco, num suporte (um lampião de popa), alargue o contorno ali para a peça ficar na altura do convés.
5. **Em volta:** `rocha`, `palmeira`, `bote`; um cais é outra plataforma, baixa.
6. **Chegada e câmeras** no convés. Uma câmera no mar, com `altura` de uns 5 m, mostra o navio de fora.

Um palco, um cais, um mezanino ou um degrau largo se fazem do mesmo jeito, sem `afunila`.

**A câmera acompanha o chão** nos mapas a céu aberto: a pé, ela sobe e desce a encosta mantendo a altura, e nunca entra no terreno; prédios, folhas, cercas e paredes a barram mesmo no alto de um morro.

**Um morro.** O formato não tem terreno inclinado, mas camadas com `encosta` fazem um morro liso: cada camada é o contorno do topo ampliado a partir do mesmo centro, mais baixa que a de cima, e o `afunila` de cada uma é escolhido para a encosta passar exatamente pela borda da camada de baixo, na altura dela. Com contorno `c` (escala em relação ao topo) na altura `h`, e a camada de baixo com escala `c2` na altura `h2`, o `afunila` é `(c2 / c - h2 / h) / (1 - h2 / h)`; na última camada, `h2 = 0` e `c2` é o pé do morro. Seis a oito camadas bastam; encosta de até uns 20° se sobe andando. Peças e câmeras sobem pela camada que as contém, não pela encosta: ponha câmeras no topo ou fora do morro, e saiba que as árvores da encosta ficam um pouco enterradas (o que não se nota).

## Lugar inteiro visto do alto

Quando a imagem mostra uma cidade, uma vila ou uma base inteira, com os prédios desenhados em pé e vistos de fora, o mapa é o lugar todo e ninguém entra nos prédios.

- `ceuAberto`, sem `teto` e sem `moldura`.
- **Não é perspectiva:** nesses desenhos as ruas laterais e os muros podem abrir um pouco para baixo. Se a rua central mantém a largura e as casas o tamanho, do alto ao pé da imagem, siga em frente.
- *(Esta seção é para quando só há uma pintura do lugar inteiro. Com imagens em camadas, use "Cidade em camadas", lá em cima.)*
- **Cada prédio pintado vira um item de `predios`:** `{ "area": [x0, y0, x1, y1], "altura": 3, "telhado": "duas-aguas", "cor": "#5a4632" }`. As paredes sobem do retângulo e o telhado leva por cima o pedaço da pintura que está dentro dele: visto do alto o lugar continua sendo a imagem original, e de lado ganha paredes e janelas que acendem à noite.
  - `area` é o retângulo do **telhado pintado**, sem a fachada.
  - `fachada`: a altura, em pixels, da frente pintada logo abaixo do telhado (comum em vista oblíqua). O volume desce para o pé dela e a frente pintada fica **em pé**, aplicada na parede. Sem isso, a fachada sobra deitada no chão diante do prédio. A `altura` do prédio fica em torno de `fachada × escala × 0,8`.
  - `frente: "gerada"`: em vez da pintura esticada (que borra de perto), a frente é feita pelo programa, com o `acabamento` do prédio, porta e janelas com moldura. Use quando a imagem tem pouca resolução ou a fachada é simples (tijolo, concreto); mantenha a pintada nos prédios ornamentados (um hotel, uma mansão).
  - `silhueta`: para prédios com torres e pontas (mansão, igreja, castelo). É o contorno do prédio pintado, uma lista de pontos `[x, y]` em volta dele, seguindo as pontas. A pintura inteira do prédio fica em pé na frente do volume, recortada nesse contorno, e as pontas aparecem contra o céu. Nesse caso `area` é só o corpo do prédio (com a frente no pé da pintura), `corTelhado` dá a cor do telhado do corpo, e a altura sai da pintura (`fatorAltura`, padrão 0,72, desfaz o esticamento da vista oblíqua). Ponha torres de verdade atrás do recorte, com `casa` de telhado `quatro-aguas` alto, para o prédio não parecer uma placa visto de lado.
  - `corTelhado`: telhado liso nessa cor, em vez da pintura.
  - **Reconstrução em peças, sem a pintura:** quando a pintura do prédio borra ou não convence, monte-o com vários `predios` pequenos (nave, transepto, abside e torre de uma igreja; a torre é um prédio estreito com `quatro-aguas` e `ht` alto), todos com `acabamento`, `corTelhado` e `janelas: false`, e ponha os detalhes com `caixa`: janelas altas e escuras, contrafortes, hera (caixa fina verde na parede), entulho (`rocha` pequena). Tire a pintura original do chão com `apagar.py --ladrilhar`.
  - **Amostra para remendo:** olhe a amostra ampliada antes de usar. Uma árvore ou um carro dentro dela se repete em espelho por toda a área.
  - `acabamento` (os mesmos das paredes) e `cor` para as outras paredes; `porta: false`; `beiral` (padrão 0,25 m).
  - **Depois de tirar a pintura, remende o buraco** com `apagar.py --ladrilhar ... --amostra ...`, usando um pedaço de rua, pátio ou mato de perto, e ponha algo em cima (carros, árvores, um corpo de trás para o prédio).
  - **Tire a pintura do chão:** o prédio 3D fica no pé da fachada, e o telhado e a fachada pintados sobrariam no piso atrás dele. Rode `python3 ferramentas/apagar.py planta.png planta_chao.png --predios mapas/<id>.json`, aponte `imagem` para `planta_chao.png` e `imagemPredios` para a planta original (é dela que os telhados e as fachadas continuam saindo). Refaça esse passo sempre que mudar os prédios.
  - `altura` das paredes: 3 m por andar. `telhado`: `duas-aguas` (a cumeeira corre no lado maior), `quatro-aguas` ou `plano`. `ht` muda a altura do telhado; `cor` é a das paredes; `janelas: false` tira as janelas.
  - Prédio em L ou com alas: um retângulo por ala.
- **Peças prontas só para o que se destaca:** `torreAndares` (castelo, pagode), `casa` com `telhado: "arco"` (hangar), `portao`, `torii`. Elas cobrem a pintura com geometria própria; use poucas.
- **Peça alta e estreita** (torre, pagode, guarita, torii, árvore): a pintura é quase toda fachada. Ponha `x`, `y` no pé da pintura, com `w` e `d` iguais à largura dela; o alto da pintura fica no chão, atrás da peça. A altura é a da fachada pintada, em pixels, vezes a escala.
- **O que fica no telhado** (antena, redoma, parabólica sobre um prédio): ponha a peça no ponto do prédio com `"sobre": <altura do prédio>`. `sobre` ergue qualquer peça.
- **Hangar:** `casa` com `telhado: "arco"`. O arco cobre a largura e a boca, com o portão, fica na frente.
- **Ruas, praças, plantações, água e pátios** ficam como pintura.
- **Muralhas e muros:** `paredes` com `faixa` e `altura`; a faixa cobre o muro e o telhadinho dele, não o talude de pedra ao pé. Portões ficam como vão, com a peça `portao` no meio dele: dois pilares e um telhado, e passa-se por baixo. Um portão que abre: duas `portas`, uma de cada lado, com a dobradiça na ponta de fora (cada folha até 3,5 m).
- **Labirinto de sebes, muretas, canteiros:** não trace à mão; use `relevo.py` na área deles e junte a lista em `predios`.
- **Água:** fica como pintura, e criaturas andam por cima dela. Se isso importa, feche a margem com `barreiras`. Um cais é uma plataforma de 0,3 m, que elas sobem sem degrau.
- **O resto em 3D:** árvores (`arvore`, `pinheiro`, `palmeira`), `torii`, `ponte`, `poste`, `tenda`, `bote`, `container`, `torreTrelica`, `domo`, `parabolica`, `veiculo`, `guindaste`. Cais e muralhas largas em que se anda por cima são `plataformas`.
- **São muitas peças:** gere o arquivo com um script. Comece pelos prédios grandes e pelas muralhas, depois as fileiras de casas, depois árvores e detalhes. Uma base tem umas 100 peças e uma cidade passa de 200; o programa aguenta. Confira no script que casas não se sobrepõem e que luzes, postes, câmeras e a chegada não caíram dentro de um volume.
- **Luzes:** poucas e largas (raio de 10 a 20 m), nas praças e ruas principais; só acendem à noite.
- **Postes e lanternas ficam na calçada**, nunca no asfalto nem no meio de um cruzamento. Confira a cor do chão no ponto (ou leia na grade) antes de pôr.
- **Câmeras:** uma na entrada, uma na praça ou rua principal, uma diante do prédio mais importante, com `altura` de 3 a 8 m. A `chegada` fica numa rua, do lado de fora dos volumes.

## O melhor material de entrada

Uma pintura só, inclinada, com chão, prédios e rótulos misturados, dá um mapa com remendos e fachadas borradas. O resultado mais bonito vem de três tipos de imagem, que a mesma IA de imagem faz se a pessoa pedir:

1. **Chão limpo:** o lugar visto exatamente de cima, só com o que é chão (ruas, calçadas, grama, água, lajes onde ficam os prédios), sem prédios, árvores, rótulos nem sombras. É a `imagem` do mapa.
2. **Folha de cada prédio importante:** quatro vistas sem perspectiva, lado a lado, sobre fundo liso: frente, lateral direita, fundos e telhado visto de cima. Vai em `assets/predios/`.
3. **Atlas de texturas:** quadros de tijolo, pedra, ardósia, telha, sebe, vistos de frente. Vai em `assets/texturas/`.

**Folhas (`folhas`).** `python3 ferramentas/folha.py assets/predios/hotel.png` acha as quatro vistas e imprime o trecho pronto. No mapa:

```json
"folhas": [{ "imagem": "assets/predios/hotel.png", "frente": [33, 206, 480, 734], "lado": [530, 207, 752, 734],
             "fundos": [803, 211, 1193, 734], "telhado": [1252, 348, 1651, 720],
             "x": 652, "y": 735, "giro": 0, "largura": 26, "profundidade": 17 }]
```

- `x`, `y`: o centro do prédio na planta; `giro` como nos móveis (0 = frente para baixo).
- `largura`: a da frente, em metros. A altura sai da proporção da vista de frente; `profundidade` sai da vista lateral, ou é dada para o prédio caber no terreno.
- O fundo liso da folha some sozinho, e **o volume é esculpido pelas silhuetas**: o prédio é cortado em fatias e, em cada altura, só existe onde a frente e a lateral têm desenho. Torres, empenas e recuos ficam com volume de verdade, cada face com a arte da sua vista e os topos com a vista do telhado. `fatias` (padrão 72) é em quantas camadas ele é cortado. Limite conhecido: telhados inclinados saem em degraus, e o topo de prédios com muitas torres fica confuso visto de cima.
- `sobre` ergue a peça (uma agulha em cima de uma torre); `colide: false` deixa passar, e a câmera também deixa de tratar a folha como chão (para uma copa, um arco, um toldo).
- `vao`: `{ "de": 0.72, "ate": 0.95, "margem": 0.3 }` esvazia o miolo de um trecho maciço, entre as alturas `de` e `ate` (0 no pé da vista, 1 no topo): fica só a casca, com parede de `margem` metros, piso e borda. É a cabine aberta de uma torre de vigia, o alto de um coreto. Postes e peças estreitas no trecho ficam como estão.
- **Tamanho pelo chão:** se o chão limpo traz a laje de cada prédio, dê `x`, `y`, `largura` e `profundidade` pela laje (largura da laje em pixels vezes a escala), para o prédio pisar exatamente nela. Se com isso ele ficar alto demais, `altura` fixa a altura em metros (a arte achata um pouco na vertical).
- `telhadoFrente`: de que lado da vista do telhado fica a frente do prédio: `baixo` (padrão), `direita`, `esquerda` ou `cima`. Serve quando o telhado vem deitado na folha (`folha.py` avisa).
- `escadas`: a escada ou o alpendre que a vista lateral mostra no pé do prédio fica pintado na fachada (padrão). `"volume"` faz a escada avançar, mas costuma deixar a entrada quadrada.
- `alturaTelhado` não existe mais: o telhado sai da própria silhueta.
- **Folha com as vistas em duas fileiras, rótulos e linha de chão:** `folha.py` resolve sozinho. Fundo em degradê também; se sobrar uma auréola em volta do prédio, baixe a `tolerancia` (0,08).
- **Folha suja:** se a IA de imagem misturou o mapa de referência no fundo, ou pôs névoa em volta das vistas, limpe antes: `folha.py suja.png --limpar limpa.png --manter x y x y ...` (um `--manter` por vista, contornando o prédio; meça com a grade). O que cobriu uma fachada se remenda com `apagar.py --colar`. Ou peça outra folha, dizendo "fundo cinza liso, sem a imagem de referência".
- **Névoa em volta das vistas:** `--limpar` com `--nevoa 6` apaga o fundo borrado dentro das áreas mantidas e para no traço do desenho; aí o `--manter` pode ser um retângulo folgado por vista.
- **Chaminé, torre ou anexo ao lado do prédio:** faça duas peças. O prédio usa os retângulos sem a chaminé; a chaminé é outro item de `folhas`, só com `frente`, no lugar que a vista do telhado mostra. Tire a chaminé da vista lateral acima dos telhados (não a inclua no `--manter`), senão ela vira um bloco fantasma em cima do prédio.
- **Alturas das vistas:** se a frente é mais alta que a lateral ou os fundos na folha (chaminés, um frontão), dê às três o mesmo `y0` e `y1` da frente, para a altura bater. Se as vistas não combinam em largura (a IA de imagem erra nisso), dê a `profundidade` à mão.

**Folha modular** (paredes, torres, portas e pilares soltos, mais a planta do lugar). `python3 ferramentas/folha.py folha.png --pecas --conferir rascunho/f.png` lista o retângulo de cada peça. Cada uma vira um item de `folhas` só com `frente`:

- **parede:** `profundidade` de 0,5 a 0,8 m; o centro em `x`, `y` e o `giro` apontando para fora do prédio;
- **torre, agulha, pilar:** sem `profundidade` (a peça fica simétrica, com a mesma arte dos quatro lados);
- se uma etiqueta de número encosta na peça, apare o retângulo para ela ficar de fora;
- use a mesma proporção de metros por pixel em todas as peças da folha, para as alturas combinarem;
- deixe um vão ou uma parede quebrada por onde se entra.

**Decalques (`decalques`).** Um pedaço de chão vindo de outra imagem, deitado sobre o piso: a planta da ruína, o pátio de uma subestação, uma praça.

```json
"decalques": [{ "imagem": "assets/predios/capela.png", "recorte": [16, 225, 619, 700], "x": 330, "y": 738, "largura": 17, "giro": 0, "semFundo": true, "brilho": 1.2 }]
```

`recorte` é o trecho da imagem (sem ele, a imagem inteira); `largura` em metros; `semFundo` tira o fundo liso em volta do desenho. Ponha as peças 3D em cima do que está pintado nele.

**Texturas do atlas (`texturas`).** Cada quadro ganha um nome e vira acabamento:

```json
"texturas": { "tijoloArte": { "imagem": "assets/texturas/atlas.png", "recorte": [4, 4, 414, 466], "metros": 1.8 } }
```

`recorte` é o quadro dentro da imagem e `metros` é quanto ele cobre antes de repetir. O nome vale em `acabamento` (paredes e prédios) e em `telhadoAcabamento` (o telhado de um item de `predios`, em vez da pintura).

Com chão limpo, os outros prédios são itens de `predios` com `area` na laje pintada, `acabamento` do atlas e `telhadoAcabamento`; não há fachada para pôr em pé nem pintura para apagar.

## O lado de fora do prédio

Se a planta mostra o lado de fora com detalhes (jardim, vegetação, caminho de pedra, cerca, calçada), ele faz parte do mapa:

- Sem `moldura`, para o lado de fora aparecer.
- `teto` com `area` igual ao retângulo do prédio, para não haver teto sobre o jardim.
- Luzes também do lado de fora, mais frias e espaçadas (luar: `#9fb4d6`, força 0,1).
- Vegetação e objetos de fora em 3D: arbusto é um `cilindro` verde baixo; árvore, um cilindro alto ou tronco mais copa; bancos e caixotes como dentro. Cercas com `grades`, deixando uma abertura.
- A `chegada` pode ficar do lado de fora, no caminho que leva à entrada, com a passagem de saída na ponta desse caminho.
- Ao endireitar uma planta em perspectiva, não use `--recortar`: a imagem inteira é mantida e o lado de fora não se perde.

Se o lado de fora é só uma borda vazia ou escura, use `moldura` e deixe a `chegada` dentro.

## Móveis do kit

Tamanhos em metros; `cor` em hexadecimal. Todos aceitam `x`, `y` (posição na planta) e `giro`.

| `tipo` | Opções |
|---|---|
| `cama` | `w`, `l` (comprimento), `cor` (colcha). A cabeceira fica do lado oposto à frente. |
| `mesa` | `w`, `d`, `h`, `cor`, `pes` |
| `mesaRedonda` | `r`, `h`, `cor` |
| `cadeira`, `banqueta` | `cor` (banqueta: `h`) |
| `sofa` | `w` (0,85 dá uma poltrona), `cor` |
| `balcao` | `w`, `d`, `h`, `cor`, `tampo` |
| `estante` | `w`, `h`, `d`, `cor`, `itens` (lista de cores dos objetos nas prateleiras). O fundo fica do lado oposto à frente. |
| `caixote` | `w`, `h`, `d`, `cor` |
| `caixa` | `w`, `h`, `d`, `cor`, `alt` (ergue do chão, em metros) |
| `cilindro` | `r`, `h`, `cor`, `alt` |
| `barril` | `cor` |
| `maca`, `banheira`, `vaso`, `pia`, `sinuca`, `jukebox`, `lareira` | sem opções obrigatórias |
| `rackArmas` | `w`, `h` |
| `alcapao` | `w`, `d` |
| `vela`, `castical` | acesos; combine com uma luz no mesmo ponto |

### Peças de céu aberto

| `tipo` | Opções |
|---|---|
| `mastro` | `h` (altura; 13 a 19 m), `w` (comprimento da verga; 9 a 12 m), `velas` (0 a 3 panos; 2 é o comum, 3 no mastro grande), `recolhidas: true` (panos enrolados), `cor`, `pano`. A verga cruza de um bordo ao outro; a frente é a proa. |
| `canhao` | `l` (comprimento), `cor`. A boca aponta para a frente. |
| `timao` | `r` (raio da roda) |
| `gurupes` | `l` (comprimento); nasce no ponto dado e se estende para a frente, subindo |
| `bote` | `l` (comprimento, no eixo da frente; 3,4), `w` (boca; 1,4), `cor`, `vela: true` |
| `rocha` | `r` (raio no chão; 0,8 a 2), `h` (padrão: quase igual a `r`), `cor` (gelo: `#dfeaf2`) |
| `arvore` | `h`, `r` (raio da copa), `cor` (cerejeira: `#f2a6c4`), `tronco` |
| `pinheiro` | `h`, `r`, `cor`, `neve: true` |
| `palmeira` | `h` (5 a 7), `cor` |
| `arbusto` | `r`, `cor` |
| `casa` | `w`, `d`, `h` (altura das paredes), `telhado`: `duas-aguas`, `quatro-aguas`, `japones`, `plano` ou `arco` (hangar); `cor` (paredes), `corTelhado`, `ht` (altura do telhado), `beiral`, `neve: true`, `porta: false`, `janelas: false`, `andares` (fileiras de janelas; padrão: uma a cada 3 m). As janelas ficam escuras de dia e acesas à noite. `w` e `d` são as paredes, sem o beiral. A cumeeira corre na largura e a porta fica na frente; no `arco`, a boca do hangar é a frente. |
| `torreAndares` | `w`, `d`, `andares`, `h` (por andar), `cor`, `corTelhado`, `reduz` (quanto cada andar encolhe; 0,8), `base` (altura de uma base de pedra). Castelo: largo, 3 andares. Pagode: estreito, 5 andares. |
| `torii` | `w`, `h`, `cor` |
| `portao` | `w` (vão livre entre os pilares), `h` (altura da passagem). Com `estilo: "ferro"`: portão de mansão ou cemitério, com pilares de pedra (`textura`), duas folhas de grade abertas `abertura` graus e arco de ferro. Sem estilo: pilares e telhado (`d`, `cor`, `corTelhado`, `telhado`: `japones` ou `plano`); criaturas e câmera passam por baixo. |
| `chafariz` | `r` (raio do tanque), `niveis` (1 ou 2 taças), `textura` (padrão `pedraMuro`): tanque, coluna torneada, taças e fios de água caindo. |
| `banco` | `w`, `estilo`: `igreja` (encosto alto, genuflexório) ou `praca` (ripas e pés de ferro), `cor`, `quebrado: true`. A frente é para onde quem senta olha. |
| `radar` | `h`, `r`, `cor`; a antena gira |
| `ponte` | `w` (comprimento, de uma margem à outra; com giro 0 corre na horizontal da imagem), `d` (largura), `h` (altura do arco, até 1,2), `cor` (corrimão), `piso`. Anda-se por cima, de uma ponta à outra; pelos lados ela é um obstáculo. |
| `poste` | `h` (rua: 3; lampião de navio: 1,4), `cor`, `luz` (cor da lanterna) |
| `tenda` | `w`, `d`, `h`, `cor` (lona) |
| `cerca` | `w` (comprimento; com giro 0 corre na horizontal da imagem), `h` (1,25), `cor`, `vao` (distância entre moirões, 2,4): cerca de madeira com moirões e duas travessas. Colide em toda a extensão (criaturas e câmera não passam) e não conta como chão. Para cercar um lugar, junte trechos de 5 a 8 m; numa encosta, trechos de 2 m com `sobre` na altura do chão. |
| `fogueira` | `r` (raio, 0,9), `h` (altura das toras, 1,7), `cor` (toras): anel de pedras, toras em pirâmide e chama que tremula, acesa de dia e de noite. Ponha uma luz quente no mesmo ponto (`forca` 0,4, `raio` 16). `acesa: false`: só pedras e lenha, sem chama (o "antes" de um desafio). |
| `barracaDesmontada` | `w` (comprimento do feixe, 1,8), `cor` (da lona): a lona enrolada e amarrada, o feixe de varas, uma lona dobrada e as estacas, no chão. É o "antes" de uma barraca num desafio. |
| `container` | `w` (comprimento), `h`, `d`, `cor` |
| `domo` | `r` (raio da redoma), `base` (altura do pedestal em que ela se apoia), `cor` |
| `parabolica` | `r` (raio do prato), `h` (altura do pedestal), `cor`; a frente é para onde aponta |
| `torreTrelica` | `h`, `w` (base), `cor`, `luz: false` (a luz vermelha do topo pisca) |
| `transformador` | `w`, `d`, `h`, `cor`: tanque com aletas, tanque de óleo e três buchas de porcelana |
| `portico` | `w` (vão entre os pés), `h`, `cor`, `isoladores` (quantas cadeias penduradas): a estrutura de subestação por onde passam os cabos. A viga corre na largura. |
| `cabo` | `l` (comprimento), `h` (altura na saída), `h2` (altura na chegada), `flecha` (barriga), `n` (cabos lado a lado), `sep`: sai do ponto dado e vai para a frente. Para ligar dois pontos, `giro` é o ângulo entre eles e `l` a distância em pixels vezes a escala. |
| `veiculo` | `modelo`: `jipe` (1,8 x 3,8 m) ou `caminhao` (2,3 x 6,2 m); `l` muda o comprimento e o veículo inteiro acompanha; `cor` |
| `guindaste` | `h`, `alcance`, `cor` |

Todas as peças, de céu aberto ou não, aceitam `"sobre": <metros>` para ficar em cima de outra coisa. Com giro 0, `w` é a medida na horizontal da imagem e `d` (ou `l`), na vertical. **`giro` positivo gira no sentido anti-horário na tela** (90 = a frente vira para a direita), igual para móveis, folhas e decalques; peça em cima de um decalque girado precisa ter a posição girada junto. Uma peça erguida com `alt` ou `sobre` não deixa as criaturas passarem por baixo; a câmera passa.

`caixa` e `cilindro` servem para o que o kit não tem (um banco de igreja é uma `caixa` baixa e comprida; uma coluna, um `cilindro`). Com `alt` dá para fazer um telhado sobre pilares, a copa de uma árvore ou um quadro na parede (uma caixa fina erguida).

**Escadas que sobem:** uma fileira de caixas com alturas crescentes. Criaturas sobem degraus de até 0,3 m. Se a escada leva a outro mapa, ponha uma passagem no topo. Se não leva a lugar nenhum, ou leva a um andar que ainda não é mapa, feche o topo com uma barreira e diga qual passagem falta.

**Escadas que descem:** o piso não afunda. Deixe a escada como pintura, ponha a passagem na boca dela e uma barreira logo depois, para ninguém andar sobre a pintura.

**Sobe ou desce?** Num andar de cima, a escada que chega do andar de baixo desce. Se há outro andar já mapeado, veja onde fica a escada dele. Se não der para saber, escolha e diga que é chute.

**Passagem de escada:** `"anim": "corte"` e `"altura": 1.3` acima do piso onde ela está.

**Ligação entre andares:** cada andar é um mapa. A passagem da escada de um aponta para o outro com `destino: { "mapa": "<id>" }`. Para chegar perto da escada do outro andar, e não na entrada dele, crie lá uma câmera na escada e use `"camera": n`. A ligação só fica completa com uma passagem em cada mapa.

**O que fica em 3D:** o piso já mostra os móveis pintados. Cubra o que tem mais de uns 0,6 m ou se repete muito (mesas, camas, sofás, balcões, estantes, carteiras) e deixe cadeiras e objetos pequenos como pintura. Móveis altos barram as criaturas, mas a câmera passa por cima.

## Desafios: antes e depois

Para o que os jogadores constroem durante a sessão (montar as barracas, acender a fogueira, consertar a ponte): cada peça ganha `"desafio": "<nome>"`. Sem mais nada, ela é o **depois** (a barraca montada) e só aparece quando o mestre marca o desafio como feito. Com `"fase": "antes"`, ela é o **antes** (o material no chão, a lenha apagada) e some nessa hora. Vale para `folhas`, `moveis` e `luzes`; várias peças podem ter o mesmo desafio.

```json
"folhas": [{ "imagem": "assets/predios/barraca.png", "frente": [...], "x": 3270, "y": 568, "giro": 51, "largura": 3.4, "desafio": "Cabana 1" }],
"moveis": [
  { "tipo": "barracaDesmontada", "x": 3270, "y": 568, "giro": 51, "w": 1.9, "desafio": "Cabana 1", "fase": "antes" },
  { "tipo": "fogueira", "x": 3315, "y": 604, "acesa": false, "desafio": "Fogueira", "fase": "antes" },
  { "tipo": "fogueira", "x": 3315, "y": 604, "desafio": "Fogueira" }
],
"luzes": [{ "x": 3315, "y": 604, "altura": 1.2, "cor": "#ff8a3a", "forca": 0.45, "raio": 16, "desafio": "Fogueira" }],
"desafios": [{ "nome": "Cabana 1" }, { "nome": "Fogueira", "acao": "acender" }]
```

Na tela do mestre aparece o botão **Desafios** entre as câmeras. O painel lista cada desafio com o botão de fazer e de desfazer (montar/desmontar, acender/apagar) e tem "Fazer tudo" e "Recomeçar". Com ele aberto, o nome de cada desafio aparece em cima do lugar, só na tela do mestre. Tudo começa por fazer. As peças em folha sobem do chão em uns 2 segundos, as luzes acendem aos poucos e a segunda tela acompanha. Peça escondida não barra quem anda nem conta como chão.

## O que o formato ainda não faz

- Teto que não seja um retângulo só.
- Moldura que não seja um retângulo (prédio em L).
- Piso rebaixado (escada que desce, porão aberto).
- Telhado sobre cômodos em que se entra (o telhado existe só na peça `casa`, que é fechada).
- Entrar nos prédios de um mapa de cidade (cada interior é outro mapa).
- Peças que ainda não existem: aeronave, empilhadeira, roda d'água, enxárcias, navio grande pronto (faz-se com plataformas).
- Janelas.
- Peças arredondadas além de cilindros (um balcão em U vira três balcões retos).
- Sala oculta que não seja formada por retângulos retos.

## Cuidados que evitam defeitos

- **Móvel em cima do desenho**, não ao lado.
- **Luz no meio do cômodo**, não dentro de uma parede.
- **`x` e `y` de um móvel são sempre a posição na planta.** Para erguer do chão, a opção é `alt`.
- **As cores saem mais claras** que o hexadecimal, por causa da luz do sol e do brilho: escureça bem pedras, metais e cinzas (um cinza `#5b5d58` aparece quase branco).
- **Água:** de perto, `forca` de 0,1 a 0,25; vista do alto, menos ainda.
- **Mapa com erro** é ignorado ao carregar e o motivo aparece no console do navegador; os outros mapas continuam funcionando.

## Exemplos

Vêm com o programa:

- `mapas/navio_pirata.json`: navio visto de cima, com casco e tombadilho em `plataformas`, mastros, canhões, rochas, palmeiras e cais; céu aberto.
- `mapas/base_artica.json`: base inteira vista do alto, com prédios em `casa`, hangares, muralha em `faixa`, torres, contêineres e veículos.
- `mapas/cidade_feudal.json`: cidade inteira vista do alto, com mais de 200 peças (castelo, pagode, casas, muralhas, pontes, cais, árvores).
