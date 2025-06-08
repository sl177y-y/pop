import { NextRequest, NextResponse } from 'next/server';
import { freeCreditSystemHealthCheck } from '@/lib/server/db';

export async function GET(request: NextRequest) {
  try {
    console.log('[health-check] Running free credit system health check');
    
    const healthResult = await freeCreditSystemHealthCheck();
    
    console.log('[health-check] Health check result:', healthResult);
    
    const statusCode = healthResult.healthy ? 200 : 503;
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      healthy: healthResult.healthy,
      checks: healthResult.checks,
      errors: healthResult.errors,
      message: healthResult.healthy 
        ? 'Free credit system is healthy' 
        : 'Free credit system has issues'
    }, { status: statusCode });
    
  } catch (error) {
    console.error('[health-check] Error running health check:', error);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      healthy: false,
      error: 'Failed to run health check',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 