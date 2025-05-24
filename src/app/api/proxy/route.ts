
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url'); // Renamed for clarity

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL de destino é obrigatória' }, { status: 400 });
  }

  try {
    const decodedTargetUrl = decodeURIComponent(targetUrl);

    // Use a generic User-Agent, as some IPTV services might block default fetch/Node.js agents
    const response = await fetch(decodedTargetUrl, {
      headers: {
        'User-Agent': 'StreamVerse/1.0 (Next.js Proxy)', // Or a more common browser UA string
        'Accept': '*/*', 
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      const upstreamStatusDescription = `${response.status}${response.statusText ? ' ' + response.statusText.trim() : ''}`;
      
      let proxyGeneratedError = `Falha ao buscar do servidor upstream (${upstreamStatusDescription}).`;
      if (errorText && errorText.trim() !== '') {
        // Try to parse as JSON first, as some XC APIs return JSON errors
        try {
            const jsonError = JSON.parse(errorText);
            if (jsonError && jsonError.message) {
                 proxyGeneratedError += ` Detalhes: ${jsonError.message}`;
            } else if (jsonError) {
                 proxyGeneratedError += ` Detalhes (JSON): ${JSON.stringify(jsonError)}`;
            } else {
                 proxyGeneratedError += ` Detalhes: ${errorText.trim()}`;
            }
        } catch (e) {
            proxyGeneratedError += ` Detalhes: ${errorText.trim()}`;
        }
      } else {
        proxyGeneratedError += ` O servidor upstream retornou um erro mas não forneceu mais detalhes.`;
      }
      
      console.error(`Proxy: Falha ao buscar ${decodedTargetUrl}: ${upstreamStatusDescription}. Corpo do erro upstream: ${errorText.trim()}`);
      return NextResponse.json({ error: proxyGeneratedError }, { status: response.status });
    }

    const responseBody = await response.text();
    
    let contentType = response.headers.get('content-type') || 'application/octet-stream'; 
    
    // For M3U, ensure UTF-8 is specified if not already present
    if (contentType.toLowerCase().includes('mpegurl') && !contentType.toLowerCase().includes('charset')) {
        contentType += '; charset=utf-8';
    }
    // For JSON (like player_api.php), ensure UTF-8
    if (contentType.toLowerCase().includes('json') && !contentType.toLowerCase().includes('charset')) {
        contentType += '; charset=utf-8';
    }
    
    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': contentType,
      },
    });

  } catch (error: any) {
    console.error(`Proxy: Erro ao buscar ${targetUrl}:`, error);
    let errorMessage = `Erro interno do servidor ao tentar buscar o conteúdo via proxy.`;
    if (error.message) {
        errorMessage += ` Razão: ${error.message}`;
    }
    if (error.cause) { 
        errorMessage += ` Causa: ${String(error.cause)}`;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
